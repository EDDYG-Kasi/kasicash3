import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { DataSource, LessThan, LessThanOrEqual } from 'typeorm';
import { InboundMessage } from './entities/inbound-message.entity';
import { IngestionService } from './ingestion.service';
import { MetricsService } from '../observability/metrics.service';
import { GracefulShutdownService } from '../observability/shutdown.service';

export interface RecoveryStatus {
  enabled: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastRecovered: number;
  expectedIntervalMs: number;
  fresh: boolean;
}

/**
 * Durable recovery for the ingestion pipeline (Constitution: failures must be
 * recoverable without user re-entry). Periodically it:
 *  - replays RECEIVED messages that were never dispatched (process crashed
 *    between the durable insert and the async hand-off), once they're older
 *    than a short grace window so we never race in-flight processing;
 *  - retries FAILED messages whose backoff window (next_retry_at) has elapsed.
 * Messages that exhaust their attempts are already DEAD (dead-letter) and are
 * intentionally left for manual review, not retried.
 *
 * The worker is a plain interval (no extra scheduler dependency), guarded so
 * cycles never overlap, and its timer is unref'd so it can't keep the process
 * alive. runRecoveryCycle() is public so it can be driven directly in tests.
 */
@Injectable()
export class RecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecoveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private enabled = true;
  private lastStartedAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastErrorAt: Date | null = null;
  private lastRecovered = 0;

  private readonly intervalMs = 30_000;
  private readonly staleReceivedMs = 60_000; // RECEIVED older than this = stranded
  private readonly batchSize = 20;

  constructor(
    private dataSource: DataSource,
    private ingestion: IngestionService,
    @Optional() private metrics?: MetricsService,
    @Optional() private shutdown?: GracefulShutdownService,
  ) {}

  onModuleInit(): void {
    if (process.env.INGESTION_RECOVERY_DISABLED === 'true') {
      this.enabled = false;
      this.metrics?.setGauge('kasicash_recovery_worker_up', 0);
      return;
    }
    this.metrics?.setGauge('kasicash_recovery_worker_up', 1);
    void this.runRecoveryCycle().catch(() => {
      this.logger.error(
        'Recovery cycle failed error_code=RECOVERY_CYCLE_FAILED',
      );
    });
    this.timer = setInterval(() => {
      void this.runRecoveryCycle().catch(() => {
        this.logger.error(
          'Recovery cycle failed error_code=RECOVERY_CYCLE_FAILED',
        );
      });
    }, this.intervalMs);
    // Don't let the recovery timer hold the process open (e.g. in tests/CLI).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runRecoveryCycle(): Promise<{ recovered: number }> {
    if (this.shutdown?.isDraining()) {
      return { recovered: 0 };
    }
    if (this.running) return { recovered: 0 }; // never overlap cycles
    this.running = true;
    this.lastStartedAt = new Date();
    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.staleReceivedMs);

      const due = await this.dataSource.manager.find(InboundMessage, {
        where: [
          { status: 'RECEIVED', receivedAt: LessThan(staleBefore) },
          { status: 'FAILED', nextRetryAt: LessThanOrEqual(now) },
          // Reclaim a PROCESSING lease whose owner crashed (lease expired).
          { status: 'PROCESSING', leaseExpiresAt: LessThanOrEqual(now) },
        ],
        order: { receivedAt: 'ASC' },
        take: this.batchSize,
      });

      let recovered = 0;
      for (const row of due) {
        // Per-row isolation: one poison message must not abort the batch.
        // processMessage re-claims atomically, so this is safe to hand off.
        try {
          const processed = await this.ingestion.processMessage(row.id);
          if (processed) recovered++;
        } catch {
          this.logger.error(
            `Recovery failed inbound_id=${row.id} error_code=RECOVERY_MESSAGE_FAILED`,
          );
        }
      }
      if (recovered > 0) {
        this.logger.log(`Recovery cycle processed ${recovered} message(s)`);
      }
      this.lastRecovered = recovered;
      this.lastSuccessAt = new Date();
      this.metrics?.increment('kasicash_recovery_cycles_total', {
        result: 'success',
      });
      return { recovered };
    } catch (error) {
      this.lastErrorAt = new Date();
      this.metrics?.increment('kasicash_recovery_cycles_total', {
        result: 'failure',
      });
      throw error;
    } finally {
      this.running = false;
    }
  }

  getStatus(): RecoveryStatus {
    const fresh = this.isFresh();
    return {
      enabled: this.enabled,
      running: this.running,
      lastStartedAt: this.lastStartedAt?.toISOString() ?? null,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastErrorAt: this.lastErrorAt?.toISOString() ?? null,
      lastRecovered: this.lastRecovered,
      expectedIntervalMs: this.intervalMs,
      fresh,
    };
  }

  isFresh(now = Date.now()): boolean {
    if (!this.enabled || !this.lastSuccessAt) return false;
    if (this.lastErrorAt && this.lastErrorAt > this.lastSuccessAt) return false;
    return now - this.lastSuccessAt.getTime() <= this.intervalMs * 3;
  }
}
