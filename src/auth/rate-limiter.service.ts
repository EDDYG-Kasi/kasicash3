import {
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

interface RateWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class SecurityRateLimiterService {
  private readonly windows = new Map<string, RateWindow>();
  private operations = 0;
  private readonly maxMemoryKeys = 10_000;

  constructor(@Optional() private readonly dataSource?: DataSource) {}

  async assertAllowed(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    assertRateLimitConfiguration(limit, windowMs);
    if (this.dataSource?.isInitialized) {
      await this.assertDatabaseAllowed(key, limit, windowMs);
      return;
    }
    this.assertMemoryAllowed(key, limit, windowMs);
  }

  private assertMemoryAllowed(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    this.deleteExpiredMemoryWindows(now);
    const keyHash = hashRateKey(key);
    const existing = this.windows.get(keyHash);
    if (!existing || existing.resetAt <= now) {
      if (this.windows.size >= this.maxMemoryKeys) {
        throw new HttpException(
          'Too many requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.windows.set(keyHash, { count: 1, resetAt: now + windowMs });
      return;
    }

    existing.count += 1;
    if (existing.count > limit) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertDatabaseAllowed(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    const dataSource = this.dataSource;
    if (!dataSource) {
      throw new Error('Rate-limit database is unavailable');
    }
    const keyHash = hashRateKey(key);
    const rows = await dataSource.query<Array<{ count: number | string }>>(
      `
        INSERT INTO security_rate_limits (
          key_hash, count, window_started_at, expires_at
        ) VALUES ($1, 1, now(), now() + ($2::bigint * interval '1 millisecond'))
        ON CONFLICT (key_hash) DO UPDATE
        SET count = CASE
              WHEN security_rate_limits.expires_at <= now() THEN 1
              ELSE security_rate_limits.count + 1
            END,
            window_started_at = CASE
              WHEN security_rate_limits.expires_at <= now() THEN now()
              ELSE security_rate_limits.window_started_at
            END,
            expires_at = CASE
              WHEN security_rate_limits.expires_at <= now()
                THEN now() + ($2::bigint * interval '1 millisecond')
              ELSE security_rate_limits.expires_at
            END
        RETURNING count
      `,
      [keyHash, windowMs],
    );
    this.operations += 1;
    if (this.operations % 100 === 0) {
      await dataSource.query(
        `DELETE FROM security_rate_limits WHERE expires_at <= now()`,
      );
    }
    if (Number(rows[0]?.count ?? 0) > limit) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private deleteExpiredMemoryWindows(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

function assertRateLimitConfiguration(limit: number, windowMs: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error('Rate-limit count must be a positive safe integer');
  }
  if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new Error('Rate-limit window must be a positive safe integer');
  }
}

function hashRateKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
