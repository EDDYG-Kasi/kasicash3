import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WhatsAppClient } from './whatsapp.client';
import { DataSource, QueryFailedError } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { InboundMessage } from './entities/inbound-message.entity';
import { OnboardingService } from './onboarding.service';
import { WHATSAPP_CLIENT } from './whatsapp.client';
import { ParsingService, ParseAndPostResult } from '../parsing/parsing.service';
import { ConversationalQueryService } from '../conversational-query/conversational-query.service';

// Minimal typing of the WhatsApp Cloud API webhook payload (only what we read).
interface WaText {
  body: string;
}
export interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: WaText;
}
interface WaContactProfile {
  name?: string;
}
interface WaContact {
  wa_id?: string;
  profile?: WaContactProfile;
}
interface WaValue {
  messages?: WaMessage[];
  contacts?: WaContact[];
  statuses?: unknown[];
}
interface WaChange {
  field?: string;
  value?: WaValue;
}
interface WaEntry {
  changes?: WaChange[];
}
export interface WaWebhookPayload {
  object?: string;
  entry?: WaEntry[];
}
interface ClaimedInbound {
  wa_from: string;
  wa_message_id: string;
  payload_hash: string;
  text_body: string | null;
  message_type: string;
  wa_timestamp: Date;
  received_at: Date;
}

export interface SyntheticTextInput {
  from: string;
  text: string;
  contactName?: string;
  messageId?: string;
  timestamp?: Date;
}

export interface SyntheticTextResult {
  stored: boolean;
  duplicate: boolean;
  processed: boolean;
  inboundId?: string;
  waMessageId: string;
}

/**
 * Ack-first ingestion (Performance: webhook acknowledgment < 2s).
 * The webhook path does exactly one cheap thing per message — an idempotent raw
 * insert — and defers all processing (onboarding, replies) off the request path.
 * Duplicate deliveries collapse on UQ_inbound_messages_wa_message_id.
 * Delivery-status callbacks (value.statuses) are acknowledged and ignored in
 * Phase 2 (logged in ROADMAP/TECH_DEBT as deferred scope).
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private dataSource: DataSource,
    private onboarding: OnboardingService,
    private parsing: ParsingService,
    private conversationalQueries: ConversationalQueryService,
    @Inject(WHATSAPP_CLIENT) private wa: WhatsAppClient,
  ) {}

  async ingestWebhook(
    payload: WaWebhookPayload,
    rawBody: Buffer,
  ): Promise<{ stored: number; duplicates: number }> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    let stored = 0;
    let duplicates = 0;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue; // statuses-only callbacks: ack and skip
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const msg of value.messages) {
          const saved = await this.storeIdempotent(msg, payloadHash);
          if (!saved) {
            duplicates++;
            continue;
          }
          stored++;
          // Fire-and-forget: never block the webhook ack on processing.
          setImmediate(() => {
            void this.processMessage(saved.id, contactName).catch(
              (err: unknown) => {
                const message =
                  err instanceof Error ? err.message : String(err);
                this.logger.error(
                  `Async ingestion handoff failed for inbound ${saved.id}: ${message.slice(0, 200)}`,
                );
              },
            );
          });
        }
      }
    }
    return { stored, duplicates };
  }

  async ingestSyntheticText(
    input: SyntheticTextInput,
  ): Promise<SyntheticTextResult> {
    const timestamp = input.timestamp ?? new Date();
    const waMessageId = input.messageId ?? `dev.${randomUUID()}`;
    const msg: WaMessage = {
      id: waMessageId,
      from: input.from,
      timestamp: Math.floor(timestamp.getTime() / 1000).toString(),
      type: 'text',
      text: { body: input.text },
    };
    const syntheticPayload: WaWebhookPayload = {
      object: 'dev.whatsapp',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                contacts: [
                  {
                    wa_id: input.from,
                    profile: input.contactName
                      ? { name: input.contactName }
                      : undefined,
                  },
                ],
                messages: [msg],
              },
            },
          ],
        },
      ],
    };
    const rawBody = Buffer.from(JSON.stringify(syntheticPayload));
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const saved = await this.storeIdempotent(msg, payloadHash);
    if (!saved) {
      return {
        stored: false,
        duplicate: true,
        processed: false,
        waMessageId,
      };
    }

    const processed = await this.processMessage(saved.id, input.contactName);
    return {
      stored: true,
      duplicate: false,
      processed,
      inboundId: saved.id,
      waMessageId,
    };
  }

  private async storeIdempotent(
    msg: WaMessage,
    payloadHash: string,
  ): Promise<InboundMessage | null> {
    try {
      const row = this.dataSource.manager.create(InboundMessage, {
        waMessageId: msg.id,
        waFrom: msg.from,
        payload: msg as unknown as Record<string, unknown>,
        payloadHash,
        messageType: msg.type,
        textBody: msg.text?.body,
        waTimestamp: new Date(Number(msg.timestamp) * 1000),
        status: 'RECEIVED',
      });
      return await this.dataSource.manager.save(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Meta redelivery on the same wa_message_id. Confirm it's the same
        // content; a different payload_hash under a reused id is a provenance
        // anomaly (spoof or upstream bug), not a benign duplicate — flag it,
        // never silently collapse it (traceability).
        const existing = await this.dataSource.manager.findOne(InboundMessage, {
          where: { waMessageId: msg.id },
        });
        if (existing && existing.payloadHash !== payloadHash) {
          this.logger.warn(
            `wa_message_id ${msg.id} reused with a different payload hash; ignoring the conflicting redelivery`,
          );
        }
        return null; // already stored — do not double-process
      }
      throw err;
    }
  }

  async processMessage(id: string, contactName?: string): Promise<boolean> {
    // Atomic, lease-based claim: exactly one processor owns the row. A row is
    // claimable if it's RECEIVED/FAILED, or a PROCESSING lease that has expired
    // (previous processor crashed). Concurrent claims: the first wins and sets a
    // fresh future lease; the rest match no rows and skip — no double-processing.
    const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);
    const claimed: ClaimedInbound[] = await this.dataSource.query(
      `UPDATE inbound_messages
         SET status = 'PROCESSING', next_retry_at = $2
       WHERE id = $1
         AND (status IN ('RECEIVED', 'FAILED')
               OR (status = 'PROCESSING' AND next_retry_at <= now()))
       RETURNING wa_from, wa_message_id, payload_hash, text_body, message_type, wa_timestamp, received_at`,
      [id, leaseUntil],
    );
    if (claimed.length === 0) return false; // already handled or actively leased
    const message = claimed[0];
    const waFrom = message.wa_from;

    let replyBody: string;
    // --- Retryable core: onboarding + linking. Failure here is recorded with
    // backoff so the recovery worker can retry (or dead-letter) the message. ---
    try {
      const { business, created } =
        await this.onboarding.resolveOrCreateBusiness(waFrom, contactName);
      const queryResult = await this.conversationalQueries.handle({
        businessId: business.id,
        textBody: message.text_body,
        messageType: message.message_type,
        waTimestamp: message.wa_timestamp,
      });
      if (queryResult.handled) {
        replyBody = buildPlainReplyBody(
          created,
          business.name,
          queryResult.replyBody,
        );
      } else {
        const parseResult = await this.parsing.parseAndPost({
          businessId: business.id,
          waMessageId: message.wa_message_id,
          payloadHash: message.payload_hash,
          textBody: message.text_body,
          messageType: message.message_type,
          waTimestamp: message.wa_timestamp,
          receivedAt: message.received_at,
        });
        replyBody = buildReplyBody(created, business.name, parseResult);
      }
      await this.dataSource.manager.update(InboundMessage, id, {
        businessId: business.id,
        status: 'PROCESSED',
        processedAt: new Date(),
        error: null,
        nextRetryAt: null,
      });
    } catch (err) {
      await this.recordFailure(id, err);
      return true;
    }
    // --- Best-effort reply: the message is already PROCESSED. A send failure
    // must NOT un-process it or trigger a retry (which would double-send). ---
    try {
      await this.wa.sendText(waFrom, replyBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Reply send failed for ${id} (message already processed): ${message.slice(0, 200)}`,
      );
    }
    return true;
  }

  /**
   * Records a processing failure with exponential backoff. After MAX_ATTEMPTS the
   * message is moved to the dead-letter state (DEAD) for manual review; its raw
   * payload is always preserved, so nothing is ever lost.
   */
  private async recordFailure(id: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    const current = await this.dataSource.manager.findOne(InboundMessage, {
      where: { id },
    });
    const attempts = (current?.attempts ?? 0) + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    this.logger.error(
      `Processing failed for inbound ${id} (attempt ${attempts}/${MAX_ATTEMPTS}): ${message.slice(0, 200)}`,
    );
    await this.dataSource.manager
      .update(InboundMessage, id, {
        status: exhausted ? 'DEAD' : 'FAILED',
        attempts,
        error: message.slice(0, 500),
        nextRetryAt: exhausted
          ? null
          : new Date(Date.now() + backoffMs(attempts)),
      })
      .catch(() => undefined);
    if (exhausted) {
      this.logger.error(
        `Inbound ${id} moved to dead-letter (DEAD) after ${attempts} attempts`,
      );
    }
  }
}

// Retry policy (module-level so the recovery worker can reference it).
export const MAX_ATTEMPTS = 5;
const PROCESSING_LEASE_MS = 5 * 60_000; // a claim is valid for 5 min, then reclaimable
const BASE_BACKOFF_MS = 60_000; // 1 min
const MAX_BACKOFF_MS = 60 * 60_000; // 1 hour cap

export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

function isUniqueViolation(err: unknown): boolean {
  const driverError =
    err instanceof QueryFailedError
      ? (err.driverError as { code?: string })
      : (err as { code?: string });
  return driverError?.code === '23505';
}

function buildReplyBody(
  created: boolean,
  businessName: string,
  parseResult: ParseAndPostResult,
): string {
  const prefix = created
    ? `Welcome to KasiCash! Your business "${businessName}" is set up. `
    : '';
  if (parseResult.status === 'POSTED') {
    const label = parseResult.kind === 'SALE' ? 'sale' : 'expense';
    return `${prefix}Recorded a ${label} of ${formatRand(parseResult.amountMinor)}.`;
  }
  if (parseResult.status === 'PROPOSED') {
    const label = parseResult.kind === 'SALE' ? 'sale' : 'expense';
    return `${prefix}I think this is a ${label} of ${formatRand(parseResult.amountMinor)}. Reply YES to record it, or NO to cancel.`;
  }
  if (parseResult.status === 'CANCELLED') {
    return `${prefix}Okay, I cancelled that unconfirmed ${parseResult.kind === 'SALE' ? 'sale' : 'expense'}.`;
  }
  if (parseResult.status === 'NO_PENDING_CONFIRMATION') {
    return `${prefix}I don't have an unconfirmed transaction waiting. Send something like "sold R30 airtime" first.`;
  }
  return `${prefix}I couldn't confidently record that as a transaction yet. Try: "sold R30 airtime" or "spent R20 stock".`;
}

function buildPlainReplyBody(
  created: boolean,
  businessName: string,
  replyBody: string,
): string {
  const prefix = created
    ? `Welcome to KasiCash! Your business "${businessName}" is set up. `
    : '';
  return `${prefix}${replyBody}`;
}

function formatRand(amountMinor: string): string {
  const amount = BigInt(amountMinor);
  const cents = (amount % 100n).toString().padStart(2, '0');
  return `R${(amount / 100n).toString()}.${cents}`;
}
