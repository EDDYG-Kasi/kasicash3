import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  computeReportPeriod,
  normalizeCurrency,
  subtractMinorStrings,
  sumMinorStrings,
  toMoneyDto,
} from '../reports/reports.math';
import {
  AnalyticsGranularity,
  AnalyticsSeriesInput,
  CashBalanceSeriesDto,
  IncomeExpenseSeriesDto,
  SpendByAccountBreakdownDto,
  SpendByAccountInput,
} from './analytics.dto';
import { bucketInterval, normalizeGranularity } from './analytics.math';

const SIGNED_ENTRY_SQL = `
  CASE
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'DEBIT' THEN e.amount_minor
    WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'CREDIT' THEN -e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'CREDIT' THEN e.amount_minor
    WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'DEBIT' THEN -e.amount_minor
    ELSE 0
  END
`;

const BUCKET_SERIES_CTE = `
  range_bounds AS (
    SELECT
      timezone($4, $5::timestamptz) AS range_start_local,
      timezone($4, $6::timestamptz) AS range_end_inclusive_local,
      $5::timestamptz AS range_start_utc,
      $8::timestamptz AS range_end_utc_exclusive
  ),
  bucket_series AS (
    SELECT
      bucket.gs AS bucket_start_local,
      bucket.gs AT TIME ZONE $4 AS bucket_start_utc,
      (bucket.gs + $7::interval) AT TIME ZONE $4 AS bucket_end_utc_exclusive
    FROM range_bounds rb
    CROSS JOIN generate_series(
      date_trunc($3, rb.range_start_local),
      date_trunc($3, rb.range_end_inclusive_local),
      $7::interval
    ) AS bucket(gs)
  )
`;

interface BucketRow {
  label: string;
  bucketStartLocal: string;
  bucketStartUtc: string;
  bucketEndUtcExclusive: string;
}

interface CashBalanceRow extends BucketRow {
  cashDeltaMinor: string;
  cashBalanceMinor: string;
}

interface IncomeExpenseRow extends BucketRow {
  revenueMinor: string;
  expensesMinor: string;
}

interface SpendByAccountRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  expenseMinor: string;
}

interface SeriesQueryContext {
  businessId: string;
  currency: string;
  period: ReturnType<typeof computeReportPeriod>;
  granularity: AnalyticsGranularity;
  generatedAt: string;
  parameters: unknown[];
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async getCashBalanceSeries(
    input: AnalyticsSeriesInput,
  ): Promise<CashBalanceSeriesDto> {
    const context = this.createSeriesContext(input);
    const rows = await this.withReadOnlyQueryRunner((queryRunner) =>
      this.queryRows<CashBalanceRow>(
        queryRunner,
        CASH_BALANCE_SERIES_SQL,
        context.parameters,
      ),
    );

    return {
      businessId: context.businessId,
      currency: context.currency,
      generatedAt: context.generatedAt,
      period: context.period,
      granularity: context.granularity,
      points: rows.map((row) => ({
        label: row.label,
        bucketStartLocal: row.bucketStartLocal,
        bucketStartUtc: row.bucketStartUtc,
        bucketEndUtcExclusive: row.bucketEndUtcExclusive,
        cashDelta: toMoneyDto(
          String(row.cashDeltaMinor ?? '0'),
          context.currency,
        ),
        cashBalance: toMoneyDto(
          String(row.cashBalanceMinor ?? '0'),
          context.currency,
        ),
      })),
    };
  }

  async getIncomeVsExpensesSeries(
    input: AnalyticsSeriesInput,
  ): Promise<IncomeExpenseSeriesDto> {
    const context = this.createSeriesContext(input);
    const rows = await this.withReadOnlyQueryRunner((queryRunner) =>
      this.queryRows<IncomeExpenseRow>(
        queryRunner,
        INCOME_EXPENSE_SERIES_SQL,
        context.parameters,
      ),
    );

    return {
      businessId: context.businessId,
      currency: context.currency,
      generatedAt: context.generatedAt,
      period: context.period,
      granularity: context.granularity,
      points: rows.map((row) => {
        const revenueMinor = String(row.revenueMinor ?? '0');
        const expensesMinor = String(row.expensesMinor ?? '0');
        return {
          label: row.label,
          bucketStartLocal: row.bucketStartLocal,
          bucketStartUtc: row.bucketStartUtc,
          bucketEndUtcExclusive: row.bucketEndUtcExclusive,
          revenue: toMoneyDto(revenueMinor, context.currency),
          expenses: toMoneyDto(expensesMinor, context.currency),
          netIncome: toMoneyDto(
            subtractMinorStrings(revenueMinor, expensesMinor),
            context.currency,
          ),
        };
      }),
    };
  }

  async getSpendByAccountBreakdown(
    input: SpendByAccountInput,
  ): Promise<SpendByAccountBreakdownDto> {
    const currency = normalizeCurrency(input.currency);
    const period = computeReportPeriod(input.from, input.to, input.timezone);
    const generatedAt = new Date().toISOString();
    const rows = await this.withReadOnlyQueryRunner((queryRunner) =>
      this.queryRows<SpendByAccountRow>(queryRunner, SPEND_BY_ACCOUNT_SQL, [
        input.businessId,
        currency,
        period.startUtc,
        period.endUtcExclusive,
      ]),
    );
    const totalExpensesMinor = sumMinorStrings(
      rows.map((row) => String(row.expenseMinor ?? '0')),
    );

    return {
      businessId: input.businessId,
      currency,
      generatedAt,
      period,
      totalExpenses: toMoneyDto(totalExpensesMinor, currency),
      accounts: rows.map((row) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        expense: toMoneyDto(String(row.expenseMinor ?? '0'), currency),
      })),
    };
  }

  private createSeriesContext(input: AnalyticsSeriesInput): SeriesQueryContext {
    const currency = normalizeCurrency(input.currency);
    const granularity = normalizeGranularity(input.granularity);
    const period = computeReportPeriod(input.from, input.to, input.timezone);
    const generatedAt = new Date().toISOString();
    const endInclusiveUtc = new Date(
      new Date(period.endUtcExclusive).getTime() - 1,
    ).toISOString();

    return {
      businessId: input.businessId,
      currency,
      period,
      granularity,
      generatedAt,
      parameters: [
        input.businessId,
        currency,
        granularity,
        period.timezone,
        period.startUtc,
        endInclusiveUtc,
        bucketInterval(granularity),
        period.endUtcExclusive,
      ],
    };
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

  private async queryRows<T>(
    queryRunner: QueryRunner,
    sql: string,
    parameters: unknown[],
  ): Promise<T[]> {
    return (await queryRunner.query(sql, parameters)) as T[];
  }
}

const BUCKET_SELECT_SQL = `
  CASE
    WHEN $3 = 'month' THEN to_char(bucket_start_local, 'YYYY-MM')
    WHEN $3 = 'week' THEN to_char(bucket_start_local, 'IYYY-"W"IW')
    ELSE to_char(bucket_start_local, 'YYYY-MM-DD')
  END AS "label",
  to_char(bucket_start_local, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS "bucketStartLocal",
  to_char(timezone('UTC', bucket_start_utc), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "bucketStartUtc",
  to_char(timezone('UTC', bucket_end_utc_exclusive), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "bucketEndUtcExclusive"
`;

const CASH_BALANCE_SERIES_SQL = `
  WITH
  ${BUCKET_SERIES_CTE},
  cash_entries AS (
    SELECT
      t.occurred_at,
      (${SIGNED_ENTRY_SQL})::numeric AS delta_minor
    FROM entries e
    JOIN accounts a
      ON a.id = e.account_id
     AND a.business_id = e.business_id
    JOIN transactions t
      ON t.id = e.transaction_id
     AND t.business_id = e.business_id
    CROSS JOIN range_bounds rb
    WHERE e.business_id = $1
      AND t.currency = $2
      AND t.status IN ('POSTED', 'REVERSED')
      AND (a.code = '100' OR a.code LIKE '100.%')
      AND t.occurred_at < rb.range_end_utc_exclusive
  ),
  opening AS (
    SELECT COALESCE(SUM(ce.delta_minor), 0) AS opening_minor
    FROM cash_entries ce
    CROSS JOIN range_bounds rb
    WHERE ce.occurred_at < rb.range_start_utc
  ),
  bucket_deltas AS (
    SELECT
      b.bucket_start_local,
      b.bucket_start_utc,
      b.bucket_end_utc_exclusive,
      COALESCE(SUM(ce.delta_minor), 0) AS delta_minor
    FROM bucket_series b
    CROSS JOIN range_bounds rb
    LEFT JOIN cash_entries ce
      ON ce.occurred_at >= GREATEST(b.bucket_start_utc, rb.range_start_utc)
     AND ce.occurred_at < LEAST(b.bucket_end_utc_exclusive, rb.range_end_utc_exclusive)
    GROUP BY b.bucket_start_local, b.bucket_start_utc, b.bucket_end_utc_exclusive
  )
  SELECT
    ${BUCKET_SELECT_SQL},
    delta_minor::text AS "cashDeltaMinor",
    (opening.opening_minor + SUM(delta_minor) OVER (ORDER BY bucket_start_utc))::text AS "cashBalanceMinor"
  FROM bucket_deltas
  CROSS JOIN opening
  ORDER BY bucket_start_utc ASC;
`;

const INCOME_EXPENSE_SERIES_SQL = `
  WITH
  ${BUCKET_SERIES_CTE},
  ledger_entries AS (
    SELECT
      t.occurred_at,
      a.code AS account_code,
      (${SIGNED_ENTRY_SQL})::numeric AS signed_minor
    FROM entries e
    JOIN accounts a
      ON a.id = e.account_id
     AND a.business_id = e.business_id
    JOIN transactions t
      ON t.id = e.transaction_id
     AND t.business_id = e.business_id
    CROSS JOIN range_bounds rb
    WHERE e.business_id = $1
      AND t.currency = $2
      AND t.status IN ('POSTED', 'REVERSED')
      AND (
        a.code = '400'
        OR a.code LIKE '400.%'
        OR a.code = '500'
        OR a.code LIKE '500.%'
      )
      AND t.occurred_at >= rb.range_start_utc
      AND t.occurred_at < rb.range_end_utc_exclusive
  )
  SELECT
    ${BUCKET_SELECT_SQL},
    COALESCE(SUM(
      CASE
        WHEN le.account_code = '400' OR le.account_code LIKE '400.%'
        THEN le.signed_minor
        ELSE 0
      END
    ), 0)::text AS "revenueMinor",
    COALESCE(SUM(
      CASE
        WHEN le.account_code = '500' OR le.account_code LIKE '500.%'
        THEN le.signed_minor
        ELSE 0
      END
    ), 0)::text AS "expensesMinor"
  FROM bucket_series b
  CROSS JOIN range_bounds rb
  LEFT JOIN ledger_entries le
    ON le.occurred_at >= GREATEST(b.bucket_start_utc, rb.range_start_utc)
   AND le.occurred_at < LEAST(b.bucket_end_utc_exclusive, rb.range_end_utc_exclusive)
  GROUP BY b.bucket_start_local, b.bucket_start_utc, b.bucket_end_utc_exclusive
  ORDER BY b.bucket_start_utc ASC;
`;

const SPEND_BY_ACCOUNT_SQL = `
  WITH range_bounds AS (
    SELECT
      $3::timestamptz AS range_start_utc,
      $4::timestamptz AS range_end_utc_exclusive
  )
  SELECT
    a.id AS "accountId",
    a.code AS "accountCode",
    a.name AS "accountName",
    COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0)::text AS "expenseMinor"
  FROM entries e
  JOIN accounts a
    ON a.id = e.account_id
   AND a.business_id = e.business_id
  JOIN transactions t
    ON t.id = e.transaction_id
   AND t.business_id = e.business_id
  CROSS JOIN range_bounds rb
  WHERE e.business_id = $1
    AND t.currency = $2
    AND t.status IN ('POSTED', 'REVERSED')
    AND (a.code = '500' OR a.code LIKE '500.%')
    AND t.occurred_at >= rb.range_start_utc
    AND t.occurred_at < rb.range_end_utc_exclusive
  GROUP BY a.id, a.code, a.name
  HAVING COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0) <> 0
  ORDER BY COALESCE(SUM((${SIGNED_ENTRY_SQL})::numeric), 0) DESC, a.code ASC, a.name ASC;
`;
