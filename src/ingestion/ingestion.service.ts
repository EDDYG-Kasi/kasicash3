import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { WhatsAppDeliveryError, type WhatsAppClient } from './whatsapp.client';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { InboundMessage } from './entities/inbound-message.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { OnboardingService } from './onboarding.service';
import { WHATSAPP_CLIENT } from './whatsapp.client';
import { ParsingService, ParseAndPostResult } from '../parsing/parsing.service';
import { ConversationalQueryService } from '../conversational-query/conversational-query.service';
import { MetricsService } from '../observability/metrics.service';
import { GracefulShutdownService } from '../observability/shutdown.service';

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
  attempts: number;
}

interface WebhookDeliveryRow {
  id: string;
  status: string;
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
 * Delivery-status callbacks (value.statuses) are acknowledged and skipped until
 * TD-5 adds outbound provider message-id persistence and reconciliation.
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
    @Optional() private metrics?: MetricsService,
    @Optional() private shutdown?: GracefulShutdownService,
  ) {}

  async ingestWebhook(
    payload: WaWebhookPayload,
    rawBody: Buffer,
    signatureHeader?: string,
  ): Promise<{ stored: number; duplicates: number }> {
    if (signatureHeader) {
      return this.ingestSignedWebhook(rawBody, signatureHeader);
    }
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const validation = validateWebhookPayload(payload);
    if (!validation.ok) {
      return { stored: 0, duplicates: 0 };
    }
    return this.ingestValidatedWebhook(payload, payloadHash);
  }

  async ingestSignedWebhook(
    rawBody: Buffer,
    signatureHeader: string,
    policyMaxBytes?: number,
  ): Promise<{ stored: number; duplicates: number }> {
    const payloadHash = createHash('sha256').update(rawBody).digest('hex');
    const delivery = await this.storeWebhookDelivery(
      rawBody,
      signatureHeader,
      payloadHash,
    );
    if (delivery.status !== 'RECEIVED') {
      return { stored: 0, duplicates: 0 };
    }

    if (policyMaxBytes !== undefined && rawBody.length > policyMaxBytes) {
      await this.finishWebhookDelivery(
        delivery.id,
        'QUARANTINED',
        'PAYLOAD_TOO_LARGE',
        0,
      );
      return { stored: 0, duplicates: 0 };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      await this.finishWebhookDelivery(
        delivery.id,
        'QUARANTINED',
        'INVALID_JSON',
        0,
      );
      return { stored: 0, duplicates: 0 };
    }
    const validation = validateWebhookPayload(payload);
    if (!validation.ok) {
      await this.finishWebhookDelivery(
        delivery.id,
        'QUARANTINED',
        validation.errorCode,
        0,
      );
      return { stored: 0, duplicates: 0 };
    }

    const result = await this.ingestValidatedWebhook(
      validation.payload,
      payloadHash,
    );
    await this.finishWebhookDelivery(
      delivery.id,
      'ACCEPTED',
      null,
      validation.messageCount,
    );
    return result;
  }

  private async ingestValidatedWebhook(
    payload: WaWebhookPayload,
    payloadHash: string,
  ): Promise<{ stored: number; duplicates: number }> {
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
            this.metrics?.increment(
              'kasicash_ingestion_webhook_messages_total',
              {
                result: 'duplicate',
              },
            );
            continue;
          }
          stored++;
          this.metrics?.increment('kasicash_ingestion_webhook_messages_total', {
            result: 'stored',
          });
          // Fire-and-forget: never block the webhook ack on processing.
          setImmediate(() => {
            void this.processMessage(saved.id, contactName).catch(
              (err: unknown) => {
                const message = errorCode(err);
                this.logger.error(
                  `Async ingestion handoff failed inbound_id=${saved.id} error_code=${message}`,
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
      this.metrics?.increment('kasicash_ingestion_webhook_messages_total', {
        result: 'duplicate',
      });
      return {
        stored: false,
        duplicate: true,
        processed: false,
        waMessageId,
      };
    }
    this.metrics?.increment('kasicash_ingestion_webhook_messages_total', {
      result: 'stored',
    });

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
      if (typeof this.dataSource.transaction !== 'function') {
        return await this.insertInboundMessage(
          this.dataSource.manager,
          msg,
          payloadHash,
        );
      }
      return await this.dataSource.transaction(async (manager) => {
        await manager.query(
          `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
          [`inbound-sender:${msg.from}`],
        );
        return this.insertInboundMessage(manager, msg, payloadHash);
      });
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
            `Conflicting WhatsApp message id ignored message_id_hash=${shortHash(msg.id)}`,
          );
        }
        return null; // already stored — do not double-process
      }
      throw err;
    }
  }

  private async insertInboundMessage(
    manager: EntityManager,
    msg: WaMessage,
    payloadHash: string,
  ): Promise<InboundMessage> {
    const row = manager.create(InboundMessage, {
      waMessageId: msg.id,
      waFrom: msg.from,
      payload: msg as unknown as Record<string, unknown>,
      payloadHash,
      messageType: msg.type,
      textBody: msg.text?.body,
      waTimestamp: new Date(Number(msg.timestamp) * 1000),
      status: 'RECEIVED',
    });
    return manager.save(row);
  }

  async processMessage(id: string, contactName?: string): Promise<boolean> {
    if (this.shutdown && !this.shutdown.canStartWork()) {
      this.metrics?.increment('kasicash_ingestion_processing_total', {
        result: 'skipped_shutdown',
      });
      return false;
    }
    const work = async () => this.processMessageCore(id, contactName);
    try {
      const processed = this.shutdown
        ? await this.shutdown.track(work)
        : await work();
      this.metrics?.increment('kasicash_ingestion_processing_total', {
        result: processed ? 'claimed' : 'skipped_claim',
      });
      return processed;
    } catch (error) {
      this.metrics?.increment('kasicash_ingestion_processing_total', {
        result: 'unexpected_error',
      });
      throw error;
    }
  }

  private async processMessageCore(
    id: string,
    contactName?: string,
  ): Promise<boolean> {
    // Atomic, lease-based claim: exactly one processor owns the row. A row is
    // claimable if it's RECEIVED/FAILED, or a PROCESSING lease that has expired
    // (previous processor crashed). Concurrent claims: the first wins and sets a
    // fresh future lease; the rest match no rows and skip — no double-processing.
    const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);
    const claimToken = randomUUID();
    const claimed = await this.claimMessage(id, leaseUntil, claimToken);
    if (claimed.length === 0) return false; // already handled or actively leased
    const message = claimed[0];
    const waFrom = message.wa_from;
    const stopHeartbeat = this.startLeaseHeartbeat(id, claimToken);

    let replyBody: string;
    let finalized = false;
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
      const update = await this.dataSource.manager.update(
        InboundMessage,
        { id, status: 'PROCESSING', claimToken },
        {
          businessId: business.id,
          status: 'PROCESSED',
          processedAt: new Date(),
          error: null,
          errorCode: null,
          nextRetryAt: null,
          claimToken: null,
          leaseExpiresAt: null,
        },
      );
      finalized = update.affected === 1;
    } catch (err) {
      await this.recordFailure(id, claimToken, message.attempts, err);
      return true;
    } finally {
      stopHeartbeat();
    }
    if (!finalized) return true;
    // --- Best-effort reply: the message is already PROCESSED. A send failure
    // must NOT un-process it or trigger a retry (which would double-send). ---
    try {
      await this.wa.sendText(waFrom, replyBody);
    } catch (err) {
      this.logger.warn(
        `Reply send failed inbound_id=${id} error_code=${errorCode(err)}`,
      );
    }
    return true;
  }

  private async claimMessage(
    id: string,
    leaseUntil: Date,
    claimToken: string,
  ): Promise<ClaimedInbound[]> {
    return this.dataSource.query(
      `UPDATE inbound_messages
         SET status = 'PROCESSING',
             next_retry_at = NULL,
             claim_token = $3,
             lease_expires_at = $2
       WHERE id = $1
         AND (
           status = 'RECEIVED'
           OR (status = 'FAILED' AND next_retry_at <= now())
           OR (status = 'PROCESSING' AND lease_expires_at <= now())
         )
         AND NOT EXISTS (
           SELECT 1
           FROM inbound_messages earlier
           WHERE earlier.wa_from = inbound_messages.wa_from
             AND earlier.ingest_sequence < inbound_messages.ingest_sequence
             AND earlier.status IN ('RECEIVED', 'PROCESSING', 'FAILED')
         )
       RETURNING wa_from, wa_message_id, payload_hash, text_body, message_type, wa_timestamp, received_at, attempts`,
      [id, leaseUntil, claimToken],
    );
  }

  /**
   * Records a processing failure with exponential backoff. After MAX_ATTEMPTS the
   * message is moved to the dead-letter state (DEAD) for manual review; its raw
   * payload is always preserved, so nothing is ever lost.
   */
  private async recordFailure(
    id: string,
    claimToken: string,
    previousAttempts: number,
    err: unknown,
  ): Promise<void> {
    const attempts = Number(previousAttempts ?? 0) + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    const failureCode = errorCode(err);
    this.logger.error(
      `Processing failed inbound_id=${id} attempt=${attempts} max_attempts=${MAX_ATTEMPTS} error_code=${failureCode}`,
    );
    this.metrics?.increment('kasicash_ingestion_processing_total', {
      result: exhausted ? 'dead_lettered' : 'failed_retryable',
    });
    await this.dataSource.manager
      .update(
        InboundMessage,
        { id, status: 'PROCESSING', claimToken },
        {
          status: exhausted ? 'DEAD' : 'FAILED',
          attempts,
          error: null,
          errorCode: failureCode,
          nextRetryAt: exhausted
            ? null
            : new Date(Date.now() + backoffMs(attempts)),
          claimToken: null,
          leaseExpiresAt: null,
        },
      )
      .catch(() => undefined);
    if (exhausted) {
      this.logger.error(
        `Inbound ${id} moved to dead-letter (DEAD) after ${attempts} attempts`,
      );
    }
  }

  private startLeaseHeartbeat(id: string, claimToken: string): () => void {
    const timer = setInterval(() => {
      void this.dataSource.manager
        .update(
          InboundMessage,
          { id, status: 'PROCESSING', claimToken },
          { leaseExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS) },
        )
        .catch(() => undefined);
    }, PROCESSING_HEARTBEAT_MS);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  private async storeWebhookDelivery(
    rawBody: Buffer,
    signatureHeader: string,
    payloadHash: string,
  ): Promise<WebhookDeliveryRow> {
    const signatureHash = createHash('sha256')
      .update(signatureHeader)
      .digest('hex');
    const rows = await this.dataSource.query<WebhookDeliveryRow[]>(
      `
        INSERT INTO webhook_deliveries (
          payload_hash, signature_hash, raw_body, status
        ) VALUES ($1, $2, $3, 'RECEIVED')
        ON CONFLICT (payload_hash) DO UPDATE
        SET payload_hash = EXCLUDED.payload_hash
        RETURNING id, status
      `,
      [payloadHash, signatureHash, rawBody],
    );
    return rows[0];
  }

  private async finishWebhookDelivery(
    id: string,
    status: 'ACCEPTED' | 'QUARANTINED',
    errorCodeValue: string | null,
    messageCount: number,
  ): Promise<void> {
    await this.dataSource.manager.update(WebhookDelivery, id, {
      status,
      errorCode: errorCodeValue,
      messageCount,
      processedAt: new Date(),
    });
  }
}

// Retry policy (module-level so the recovery worker can reference it).
export const MAX_ATTEMPTS = 5;
export const PROCESSING_LEASE_MS = 5 * 60_000;
const PROCESSING_HEARTBEAT_MS = 60_000;
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

function isValidWaMessage(value: unknown): value is WaMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<WaMessage>;
  const timestamp = Number(message.timestamp);
  return (
    typeof message.id === 'string' &&
    message.id.length > 0 &&
    message.id.length <= 512 &&
    typeof message.from === 'string' &&
    /^\d{6,20}$/.test(message.from) &&
    typeof message.type === 'string' &&
    message.type.length > 0 &&
    message.type.length <= 64 &&
    Number.isInteger(timestamp) &&
    timestamp > 0 &&
    !Number.isNaN(new Date(timestamp * 1000).getTime()) &&
    (message.type !== 'text' ||
      (typeof message.text?.body === 'string' &&
        message.text.body.length > 0 &&
        message.text.body.length <= 4096))
  );
}

type WebhookValidationResult =
  | {
      ok: true;
      payload: WaWebhookPayload;
      messageCount: number;
    }
  | {
      ok: false;
      errorCode: 'INVALID_SCHEMA' | 'MALFORMED_MESSAGE';
    };

export function validateWebhookPayload(
  value: unknown,
): WebhookValidationResult {
  if (
    !isRecord(value) ||
    !Array.isArray(value.entry) ||
    value.entry.length === 0
  ) {
    return { ok: false, errorCode: 'INVALID_SCHEMA' };
  }
  let messageCount = 0;
  for (const entry of value.entry) {
    if (
      !isRecord(entry) ||
      !Array.isArray(entry.changes) ||
      entry.changes.length === 0
    ) {
      return { ok: false, errorCode: 'INVALID_SCHEMA' };
    }
    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) {
        return { ok: false, errorCode: 'INVALID_SCHEMA' };
      }
      const messages = change.value.messages;
      const statuses = change.value.statuses;
      if (messages !== undefined && !Array.isArray(messages)) {
        return { ok: false, errorCode: 'INVALID_SCHEMA' };
      }
      if (statuses !== undefined && !Array.isArray(statuses)) {
        return { ok: false, errorCode: 'INVALID_SCHEMA' };
      }
      if (
        (!Array.isArray(messages) || messages.length === 0) &&
        (!Array.isArray(statuses) || statuses.length === 0)
      ) {
        return { ok: false, errorCode: 'INVALID_SCHEMA' };
      }
      if (
        change.value.contacts !== undefined &&
        !Array.isArray(change.value.contacts)
      ) {
        return { ok: false, errorCode: 'INVALID_SCHEMA' };
      }
      for (const contact of change.value.contacts ?? []) {
        if (!isRecord(contact)) {
          return { ok: false, errorCode: 'INVALID_SCHEMA' };
        }
        if (contact.profile !== undefined) {
          if (
            !isRecord(contact.profile) ||
            (contact.profile.name !== undefined &&
              typeof contact.profile.name !== 'string')
          ) {
            return { ok: false, errorCode: 'INVALID_SCHEMA' };
          }
        }
      }
      for (const status of statuses ?? []) {
        if (!isRecord(status)) {
          return { ok: false, errorCode: 'INVALID_SCHEMA' };
        }
      }
      for (const message of messages ?? []) {
        if (!isValidWaMessage(message)) {
          return { ok: false, errorCode: 'MALFORMED_MESSAGE' };
        }
        messageCount++;
      }
    }
  }
  return {
    ok: true,
    payload: value as unknown as WaWebhookPayload,
    messageCount,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorCode(err: unknown): string {
  if (err instanceof WhatsAppDeliveryError) return err.code;
  if (err instanceof QueryFailedError) return 'DATABASE_OPERATION_FAILED';
  if (
    err instanceof Error &&
    (err.name === 'AbortError' || err.name === 'TimeoutError')
  ) {
    return 'UPSTREAM_TIMEOUT';
  }
  return 'PROCESSING_FAILED';
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
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
    return `${prefix}I think this is a ${label} of ${formatRand(parseResult.amountMinor)} (ref ${parseResult.proposalRef}). Reply YES to record it, or NO to cancel.`;
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
