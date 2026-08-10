import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

const RECONCILIATION_INTERVAL_MS = 60_000;

@Injectable()
export class AnomalyReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AnomalyReconciliationService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    void this.reconcileUnresolvedDispatches().catch(() => {
      this.logger.warn(
        'Alert reconciliation failed error_code=ALERT_RECONCILIATION_FAILED',
      );
    });
    this.timer = setInterval(() => {
      void this.reconcileUnresolvedDispatches().catch(() => {
        this.logger.warn(
          'Alert reconciliation failed error_code=ALERT_RECONCILIATION_FAILED',
        );
      });
    }, RECONCILIATION_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcileUnresolvedDispatches(): Promise<number> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(`
      UPDATE anomaly_alerts
      SET status = 'DELIVERY_UNCERTAIN',
          last_error = NULL,
          last_error_code = 'DISPATCH_OUTCOME_UNCONFIRMED',
          updated_at = now()
      WHERE status = 'SENDING'
        AND dispatch_started_at IS NOT NULL
        AND dispatch_started_at < now() - interval '15 minutes'
      RETURNING id
    `);
    return rows.length;
  }
}
