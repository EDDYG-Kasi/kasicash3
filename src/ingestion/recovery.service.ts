import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource, LessThan, LessThanOrEqual } from 'typeorm';
import { InboundMessage } from './entities/inbound-message.entity';
import { IngestionService } from './ingestion.service';

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

  private readonly intervalMs = 30_000;
  private readonly staleReceivedMs = 60_000; // RECEIVED older than this = stranded
  private readonly batchSize = 20;

  constructor(
    private dataSource: DataSource,
    private ingestion: IngestionService,
  ) {}

  onModuleInit(): void {
    if (process.env.INGESTION_RECOVERY_DISABLED === 'true') return;
    this.timer = setInterval(() => {
      void this.runRecoveryCycle().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Recovery cycle failed: ${message.slice(0, 200)}`);
      });
    }, this.intervalMs);
    // Don't let the recovery timer hold the process open (e.g. in tests/CLI).
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runRecoveryCycle(): Promise<{ recovered: number }> {
    if (this.running) return { recovered: 0 }; // never overlap cycles
    this.running = true;
    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.staleReceivedMs);

      const due = await this.dataSource.manager.find(InboundMessage, {
        where: [
          { status: 'RECEIVED', receivedAt: LessThan(staleBefore) },
          { status: 'FAILED', nextRetryAt: LessThanOrEqual(now) },
          // Reclaim a PROCESSING lease whose owner crashed (lease expired).
          { status: 'PROCESSING', nextRetryAt: LessThanOrEqual(now) },
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
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Recovery failed for inbound ${row.id}: ${message.slice(0, 200)}`,
          );
        }
      }
      if (recovered > 0) {
        this.logger.log(`Recovery cycle processed ${recovered} message(s)`);
      }
      return { recovered };
    } finally {
      this.running = false;
    }
  }
}
