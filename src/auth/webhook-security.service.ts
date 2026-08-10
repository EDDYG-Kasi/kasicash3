import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { resolveWebhookBodyLimits } from '../config/webhook-body-limits';

const DEFAULT_REPLAY_TTL_SECONDS = 5 * 60;

interface ReplayRow {
  exists: number;
}

@Injectable()
export class WebhookSecurityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async wasAcceptedRecently(rawBody: Buffer): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `
        SELECT 1 AS "exists"
        FROM webhook_replay_events
        WHERE payload_hash = $1
          AND expires_at > now()
        LIMIT 1
      `,
      [payloadHash(rawBody)],
    )) as unknown as ReplayRow[];
    return rows.length > 0;
  }

  async recordAccepted(
    rawBody: Buffer,
    signatureHeader: string,
  ): Promise<void> {
    await this.dataSource.query(
      `
        INSERT INTO webhook_replay_events (
          payload_hash,
          signature_hash,
          expires_at
        )
        VALUES ($1, $2, now() + ($3::bigint * interval '1 second'))
        ON CONFLICT (payload_hash) DO UPDATE
        SET signature_hash = EXCLUDED.signature_hash,
            expires_at = now() + ($3::bigint * interval '1 second'),
            first_seen_at = now()
        WHERE webhook_replay_events.expires_at <= now()
      `,
      [payloadHash(rawBody), sha256(signatureHeader), this.replayTtlSeconds()],
    );
  }

  maxRawBodyBytes(): number {
    return resolveWebhookBodyLimits(
      this.config.get<string>('KASICASH_WEBHOOK_MAX_RAW_BYTES'),
    ).policyBytes;
  }

  private replayTtlSeconds(): number {
    const raw = Number(
      this.config.get<string>('KASICASH_WEBHOOK_REPLAY_TTL_SECONDS') ??
        DEFAULT_REPLAY_TTL_SECONDS,
    );
    if (!Number.isInteger(raw) || raw < 30 || raw > 24 * 60 * 60) {
      return DEFAULT_REPLAY_TTL_SECONDS;
    }
    return raw;
  }
}

function payloadHash(rawBody: Buffer): string {
  return sha256(rawBody);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
