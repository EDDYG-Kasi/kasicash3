import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RecoveryService } from '../ingestion/recovery.service';
import { InboundMessage } from '../ingestion/entities/inbound-message.entity';
import { GracefulShutdownService } from './shutdown.service';
import { MetricsService } from './metrics.service';

export interface ReadinessResult {
  ok: boolean;
  status: 'ready' | 'not_ready';
  checks: Record<string, { ok: boolean; detail?: unknown }>;
  recoveryQueue: Record<string, number>;
}

interface QueueCountRow {
  status: string;
  count: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly recovery: RecoveryService,
    private readonly shutdown: GracefulShutdownService,
    private readonly metrics: MetricsService,
  ) {}

  liveness() {
    return {
      ok: true,
      status: this.shutdown.isDraining() ? 'draining' : 'live',
      inFlight: this.shutdown.inFlightCount(),
    };
  }

  async readiness(): Promise<ReadinessResult> {
    const checks: ReadinessResult['checks'] = {};
    checks.shutdown = {
      ok: !this.shutdown.isDraining(),
      detail: { inFlight: this.shutdown.inFlightCount() },
    };

    let databaseReady = false;
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = { ok: true };
      databaseReady = true;
    } catch {
      checks.database = {
        ok: false,
        detail: { code: 'DATABASE_UNAVAILABLE' },
      };
    }

    if (databaseReady) {
      try {
        const pending = await this.dataSource.showMigrations();
        checks.migrations = { ok: !pending, detail: { pending } };
      } catch {
        checks.migrations = {
          ok: false,
          detail: { code: 'MIGRATION_STATE_UNAVAILABLE' },
        };
      }
    } else {
      checks.migrations = {
        ok: false,
        detail: { code: 'DATABASE_UNAVAILABLE' },
      };
    }

    const recoveryStatus = this.recovery.getStatus();
    checks.recovery = {
      ok: recoveryStatus.enabled && recoveryStatus.fresh,
      detail: recoveryStatus,
    };

    let recoveryQueue = emptyRecoveryQueue();
    if (databaseReady) {
      try {
        recoveryQueue = await this.recoveryQueueCounts();
        checks.recoveryQueue = { ok: true };
      } catch {
        checks.recoveryQueue = {
          ok: false,
          detail: { code: 'RECOVERY_QUEUE_UNAVAILABLE' },
        };
      }
    } else {
      checks.recoveryQueue = {
        ok: false,
        detail: { code: 'DATABASE_UNAVAILABLE' },
      };
    }
    const ok = Object.values(checks).every((check) => check.ok);
    return {
      ok,
      status: ok ? 'ready' : 'not_ready',
      checks,
      recoveryQueue,
    };
  }

  async recoveryQueueCounts(): Promise<Record<string, number>> {
    const counts = emptyRecoveryQueue();
    const rawRows = (await this.dataSource.manager
      .createQueryBuilder(InboundMessage, 'message')
      .select('message.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('message.status IN (:...statuses)', {
        statuses: Object.keys(counts),
      })
      .groupBy('message.status')
      .getRawMany()) as unknown;
    const rows = normalizeQueueCountRows(rawRows);

    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status] = Number(row.count);
      }
    }
    for (const [status, value] of Object.entries(counts)) {
      this.metrics.setGauge('kasicash_recovery_queue_depth', value, {
        status,
      });
    }
    return counts;
  }
}

function emptyRecoveryQueue(): Record<string, number> {
  return { RECEIVED: 0, PROCESSING: 0, FAILED: 0, DEAD: 0 };
}

function normalizeQueueCountRows(rawRows: unknown): QueueCountRow[] {
  if (!Array.isArray(rawRows)) return [];
  return rawRows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const status = row.status;
    const count = row.count;
    if (typeof status !== 'string') return [];
    return [
      {
        status,
        count: typeof count === 'string' ? count : String(Number(count ?? 0)),
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
