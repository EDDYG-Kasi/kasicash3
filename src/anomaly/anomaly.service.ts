import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  normalizeCurrency,
  normalizeTimezone,
  computeReportPeriod,
} from '../reports/reports.math';
import { WHATSAPP_CLIENT } from '../ingestion/whatsapp.client';
import type { WhatsAppClient } from '../ingestion/whatsapp.client';
import {
  AlertDispatchResultDto,
  DetectAnomaliesInput,
  DetectedAnomalyDto,
  DispatchAnomalyAlertsInput,
} from './anomaly.dto';
import {
  buildAlertBody,
  DailyLedgerTotals,
  detectActivityGapAnomaly,
  detectLargeExpenseAnomalies,
  detectSalesVolumeAnomalies,
  DetectionContext,
  ExpenseCandidate,
  AnomalyThresholds,
  DEFAULT_ANOMALY_THRESHOLDS,
} from './anomaly.rules';

const BASELINE_LOOKBACK_DAYS = 30;

const SIGNED_ENTRY_SQL = `
  CASE
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'DEBIT' THEN e.amount_minor
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'CREDIT' THEN -e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'CREDIT' THEN e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'DEBIT' THEN -e.amount_minor
    ELSE 0
  END
`;

interface ExpenseCandidateRow {
  transactionId: string;
  description: string;
  occurredAt: string;
  amountMinor: string;
}

interface BusinessContactRow {
  id: string;
  waPhone: string | null;
}

interface AlertClaimRow {
  id: string;
  attempts: number;
}

interface CurrencyThresholdRow {
  largeExpenseFloorMinor: string;
  salesBaselineFloorMinor: string;
  salesSpikeDeltaMinor: string;
}

@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly analytics: AnalyticsService,
    @Inject(WHATSAPP_CLIENT) private readonly wa: WhatsAppClient,
  ) {}

  async detectAnomalies(
    input: DetectAnomaliesInput,
  ): Promise<DetectedAnomalyDto[]> {
    const context = this.createDetectionContext(input);
    const from = addLocalDays(context.asOfLocalDate, -BASELINE_LOOKBACK_DAYS);
    const series = await this.analytics.getIncomeVsExpensesSeries({
      businessId: context.businessId,
      currency: context.currency,
      timezone: context.timezone,
      from,
      to: context.asOfLocalDate,
      granularity: 'day',
    });
    const dailyTotals: DailyLedgerTotals[] = series.points.map((point) => ({
      localDate: point.label,
      revenueMinor: point.revenue.amountMinor,
      expensesMinor: point.expenses.amountMinor,
    }));
    const { candidates, thresholds } =
      await this.getDetectionConfigurationAndCandidates(context);

    const anomalies = [
      ...detectLargeExpenseAnomalies(
        candidates,
        dailyTotals,
        context,
        thresholds,
      ),
      ...detectSalesVolumeAnomalies(dailyTotals, context, thresholds),
    ];
    const activityGap = detectActivityGapAnomaly(
      dailyTotals,
      context,
      thresholds,
    );
    if (activityGap) anomalies.push(activityGap);
    return anomalies;
  }

  async dispatchAlerts(
    input: DispatchAnomalyAlertsInput,
  ): Promise<AlertDispatchResultDto> {
    const anomalies = await this.detectAnomalies(input);
    const contact = await this.getBusinessContact(input.businessId);
    const results: AlertDispatchResultDto['results'] = [];

    if (!contact?.waPhone) {
      return {
        businessId: input.businessId,
        detected: anomalies.length,
        sent: 0,
        skipped: anomalies.length,
        failed: 0,
        results: anomalies.map((anomaly) => ({
          anomalyKey: anomaly.key,
          type: anomaly.type,
          status: 'NO_RECIPIENT',
          reason: 'business has no wa_phone',
        })),
      };
    }

    for (const anomaly of anomalies) {
      const claim = await this.claimAlert(anomaly);
      if (!claim) {
        results.push({
          anomalyKey: anomaly.key,
          type: anomaly.type,
          status: 'SKIPPED',
          reason: 'already sent or currently sending',
        });
        continue;
      }

      try {
        const dispatchStarted = await this.beginAlertDispatch(claim.id);
        if (!dispatchStarted) {
          results.push({
            anomalyKey: anomaly.key,
            type: anomaly.type,
            status: 'SKIPPED',
            reason: 'dispatch ownership was lost',
          });
          continue;
        }
        await this.wa.sendText(contact.waPhone, buildAlertBody(anomaly));
        await this.markAlertSent(claim.id);
        results.push({
          anomalyKey: anomaly.key,
          type: anomaly.type,
          status: 'SENT',
          alertId: claim.id,
        });
      } catch {
        try {
          await this.markAlertUncertain(claim.id);
        } catch {
          this.logger.warn(
            `Anomaly delivery reconciliation pending alert_id=${claim.id} error_code=ALERT_STATE_UPDATE_FAILED`,
          );
        }
        this.logger.warn(
          `Anomaly delivery uncertain alert_id=${claim.id} error_code=PROVIDER_DELIVERY_UNCERTAIN`,
        );
        results.push({
          anomalyKey: anomaly.key,
          type: anomaly.type,
          status: 'FAILED',
          alertId: claim.id,
          reason: 'delivery outcome uncertain; automatic retry disabled',
        });
      }
    }

    return {
      businessId: input.businessId,
      detected: anomalies.length,
      sent: results.filter((item) => item.status === 'SENT').length,
      skipped: results.filter(
        (item) => item.status === 'SKIPPED' || item.status === 'NO_RECIPIENT',
      ).length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      results,
    };
  }

  private createDetectionContext(
    input: DetectAnomaliesInput,
  ): DetectionContext {
    const timezone = normalizeTimezone(input.timezone);
    const currency = normalizeCurrency(input.currency);
    return {
      businessId: input.businessId,
      currency,
      timezone,
      asOfLocalDate: input.asOfLocalDate ?? todayInTimezone(timezone),
      detectedAt: new Date().toISOString(),
    };
  }

  private async getDetectionConfigurationAndCandidates(
    context: DetectionContext,
  ): Promise<{
    candidates: ExpenseCandidate[];
    thresholds: AnomalyThresholds;
  }> {
    const period = computeReportPeriod(
      context.asOfLocalDate,
      context.asOfLocalDate,
      context.timezone,
    );
    const { rows, thresholdRow } = await this.withReadOnlyQueryRunner(
      async (queryRunner) => {
        const thresholdRows = await this.queryRows<CurrencyThresholdRow>(
          queryRunner,
          `
            SELECT
              large_expense_floor_minor::text AS "largeExpenseFloorMinor",
              sales_baseline_floor_minor::text AS "salesBaselineFloorMinor",
              sales_spike_delta_minor::text AS "salesSpikeDeltaMinor"
            FROM supported_currencies
            WHERE code = $1
          `,
          [context.currency],
        );
        const candidateRows = await this.queryRows<ExpenseCandidateRow>(
          queryRunner,
          ACTIVE_EXPENSE_CANDIDATES_SQL,
          [
            context.businessId,
            context.currency,
            period.startUtc,
            period.endUtcExclusive,
          ],
        );
        return { rows: candidateRows, thresholdRow: thresholdRows[0] };
      },
    );
    if (!thresholdRow)
      throw new Error('Currency threshold configuration missing');

    return {
      candidates: rows.map((row) => ({
        transactionId: row.transactionId,
        description: row.description,
        occurredAt: row.occurredAt,
        amountMinor: String(row.amountMinor),
      })),
      thresholds: {
        ...DEFAULT_ANOMALY_THRESHOLDS,
        largeExpenseAbsoluteFloorMinor: thresholdRow.largeExpenseFloorMinor,
        salesMinimumBaselineAverageMinor: thresholdRow.salesBaselineFloorMinor,
        salesMinimumSpikeDeltaMinor: thresholdRow.salesSpikeDeltaMinor,
      },
    };
  }

  private async getBusinessContact(
    businessId: string,
  ): Promise<BusinessContactRow | null> {
    const rows = await this.withReadOnlyQueryRunner((queryRunner) =>
      this.queryRows<BusinessContactRow>(
        queryRunner,
        `SELECT id, wa_phone AS "waPhone" FROM businesses WHERE id = $1`,
        [businessId],
      ),
    );
    return rows[0] ?? null;
  }

  private async claimAlert(
    anomaly: DetectedAnomalyDto,
  ): Promise<AlertClaimRow | null> {
    const rows = await this.queryRows<AlertClaimRow>(CLAIM_ALERT_SQL, [
      anomaly.businessId,
      anomaly.key,
      anomaly.type,
      anomaly.currency,
      anomaly.timezone,
      anomaly.period.fromLocalDate,
      anomaly.period.toLocalDate,
      JSON.stringify(anomaly),
    ]);
    return rows[0] ?? null;
  }

  private async markAlertSent(alertId: string): Promise<void> {
    await this.dataSource.query(
      `
        UPDATE anomaly_alerts
        SET status = 'SENT',
            sent_at = now(),
            last_error = NULL,
            last_error_code = NULL,
            updated_at = now()
        WHERE id = $1
          AND status = 'SENDING'
          AND dispatch_started_at IS NOT NULL
      `,
      [alertId],
    );
  }

  private async beginAlertDispatch(alertId: string): Promise<boolean> {
    const rows = await this.dataSource.query<Array<{ id: string }>>(
      `
        UPDATE anomaly_alerts
        SET dispatch_started_at = now(),
            updated_at = now()
        WHERE id = $1
          AND status = 'SENDING'
          AND dispatch_started_at IS NULL
        RETURNING id
      `,
      [alertId],
    );
    return rows.length === 1;
  }

  private async markAlertUncertain(alertId: string): Promise<void> {
    await this.dataSource.query(
      `
        UPDATE anomaly_alerts
        SET status = 'DELIVERY_UNCERTAIN',
            last_error = NULL,
            last_error_code = 'PROVIDER_DELIVERY_UNCERTAIN',
            updated_at = now()
        WHERE id = $1
          AND status = 'SENDING'
          AND dispatch_started_at IS NOT NULL
      `,
      [alertId],
    );
  }

  private async withReadOnlyQueryRunner<T>(
    callback: (queryRunner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SET TRANSACTION READ ONLY');
      const result = await callback(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  private async queryRows<T>(sql: string, parameters: unknown[]): Promise<T[]>;
  private async queryRows<T>(
    queryRunner: QueryRunner,
    sql: string,
    parameters: unknown[],
  ): Promise<T[]>;
  private async queryRows<T>(
    first: QueryRunner | string,
    second: string | unknown[],
    third?: unknown[],
  ): Promise<T[]> {
    if (typeof first === 'string') {
      return await this.dataSource.query(first, second as unknown[]);
    }
    return (await first.query(second as string, third)) as T[];
  }
}

const ACTIVE_EXPENSE_CANDIDATES_SQL = `
  WITH range_bounds AS (
    SELECT
      $3::timestamptz AS range_start_utc,
      $4::timestamptz AS range_end_utc_exclusive
  )
  SELECT
    t.id AS "transactionId",
    t.description AS "description",
    to_char(timezone('UTC', t.occurred_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAt",
    COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0)::text AS "amountMinor"
  FROM transactions t
  JOIN entries e
    ON e.transaction_id = t.id
   AND e.business_id = t.business_id
  JOIN accounts a
    ON a.id = e.account_id
   AND a.business_id = e.business_id
  CROSS JOIN range_bounds rb
  WHERE t.business_id = $1
    AND t.currency = $2
    AND t.status = 'POSTED'
    AND t.reversal_of_transaction_id IS NULL
    AND (a.code = '500' OR a.code LIKE '500.%')
    AND t.occurred_at >= rb.range_start_utc
    AND t.occurred_at < rb.range_end_utc_exclusive
  GROUP BY t.id, t.description, t.occurred_at
  HAVING COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0) > 0
  ORDER BY COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0) DESC, t.occurred_at ASC;
`;

const CLAIM_ALERT_SQL = `
  INSERT INTO anomaly_alerts (
    business_id,
    anomaly_key,
    anomaly_type,
    currency,
    timezone,
    period_start_local,
    period_end_local,
    payload,
    status,
    attempts
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'SENDING', 1)
  ON CONFLICT ("business_id", "anomaly_key") DO UPDATE
  SET status = 'SENDING',
      attempts = anomaly_alerts.attempts + 1,
      last_error = NULL,
      last_error_code = NULL,
      dispatch_started_at = NULL,
      updated_at = now()
  WHERE anomaly_alerts.status = 'FAILED'
     OR (
       anomaly_alerts.status = 'SENDING'
       AND anomaly_alerts.dispatch_started_at IS NULL
       AND anomaly_alerts.updated_at < now() - interval '15 minutes'
     )
  RETURNING id, attempts;
`;

function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function todayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;
}
