import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AnalyticsGranularity } from '../analytics/analytics.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { ReportsService } from '../reports/reports.service';
import { computeReportPeriod } from '../reports/reports.math';
import {
  DashboardAlertStatusDto,
  DashboardAnomaliesDto,
  DashboardChartScalesDto,
  DashboardKpiDto,
  DashboardOverviewDto,
  DashboardOverviewQuery,
  DashboardPeriodQuery,
  DashboardPeriodSelectionDto,
  DashboardStatementQuery,
  DashboardTenantContextDto,
} from './dashboard.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;
const MAX_PERIOD_DAYS = 366;

interface AlertStatusRow {
  anomalyKey: string;
  anomalyType: string;
  status: string;
  sentAt: Date | null;
  updatedAt: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly reports: ReportsService,
    private readonly analytics: AnalyticsService,
    private readonly anomalies: AnomalyService,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(
    tenant: DashboardTenantContextDto,
    query: DashboardOverviewQuery,
  ): Promise<DashboardOverviewDto> {
    const period = normalizeOverviewSelection(query, tenant.timezone);
    const cashPosition = await this.getCashPosition(tenant);
    const accountId =
      period.accountId ??
      cashPosition.accounts.find((account) => account.isCash)?.accountId ??
      cashPosition.accounts[0]?.accountId;

    const [
      incomeStatement,
      cashBalance,
      incomeVsExpenses,
      spendByAccount,
      dashboardAnomalies,
      accountStatement,
    ] = await Promise.all([
      this.getIncomeStatement(tenant, period),
      this.getCashBalanceSeries(tenant, period),
      this.getIncomeVsExpensesSeries(tenant, period),
      this.getSpendByAccountBreakdown(tenant, period),
      this.getCurrentAnomalies(tenant, period.asOfLocalDate),
      accountId
        ? this.getAccountStatementForSelection(tenant, accountId, period)
        : Promise.resolve(null),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      tenant,
      period: {
        ...period,
        accountId,
      },
      kpis: buildKpis(accountStatement),
      cashPosition,
      incomeStatement,
      accountStatement,
      analytics: {
        cashBalance,
        incomeVsExpenses,
        spendByAccount,
        chartScales: buildChartScales(
          cashBalance.points,
          incomeVsExpenses.points,
          spendByAccount.accounts,
        ),
      },
      anomalies: dashboardAnomalies,
    };
  }

  getCashPosition(tenant: DashboardTenantContextDto) {
    return this.reports.getCashPosition({
      businessId: tenant.businessId,
      currency: tenant.currency,
    });
  }

  getIncomeStatement(
    tenant: DashboardTenantContextDto,
    query: DashboardPeriodQuery,
  ) {
    const period = normalizePeriodSelection(query, tenant.timezone);
    return this.reports.getIncomeStatement({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      from: period.from,
      to: period.to,
    });
  }

  getAccountStatement(
    tenant: DashboardTenantContextDto,
    accountId: string,
    query: DashboardStatementQuery,
  ) {
    const period = normalizePeriodSelection(query, tenant.timezone);
    return this.reports.getAccountStatement({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      accountId,
      from: period.from,
      to: period.to,
      limit: normalizeLimit(query.limit),
      offset: normalizeOffset(query.offset),
    });
  }

  private getAccountStatementForSelection(
    tenant: DashboardTenantContextDto,
    accountId: string,
    period: DashboardPeriodSelectionDto,
  ) {
    return this.reports.getAccountStatement({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      accountId,
      from: period.from,
      to: period.to,
      limit: period.limit,
      offset: period.offset,
    });
  }

  getCashBalanceSeries(
    tenant: DashboardTenantContextDto,
    query: DashboardPeriodQuery,
  ) {
    const period = normalizePeriodSelection(query, tenant.timezone);
    return this.analytics.getCashBalanceSeries({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      from: period.from,
      to: period.to,
      granularity: period.granularity,
    });
  }

  getIncomeVsExpensesSeries(
    tenant: DashboardTenantContextDto,
    query: DashboardPeriodQuery,
  ) {
    const period = normalizePeriodSelection(query, tenant.timezone);
    return this.analytics.getIncomeVsExpensesSeries({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      from: period.from,
      to: period.to,
      granularity: period.granularity,
    });
  }

  getSpendByAccountBreakdown(
    tenant: DashboardTenantContextDto,
    query: DashboardPeriodQuery,
  ) {
    const period = normalizePeriodSelection(query, tenant.timezone);
    return this.analytics.getSpendByAccountBreakdown({
      businessId: tenant.businessId,
      currency: tenant.currency,
      timezone: tenant.timezone,
      from: period.from,
      to: period.to,
    });
  }

  async getCurrentAnomalies(
    tenant: DashboardTenantContextDto,
    asOfLocalDate?: string,
  ): Promise<DashboardAnomaliesDto> {
    const targetDate = asOfLocalDate ?? todayInTimezone(tenant.timezone);
    const [items, alertStatuses] = await Promise.all([
      this.anomalies.detectAnomalies({
        businessId: tenant.businessId,
        currency: tenant.currency,
        timezone: tenant.timezone,
        asOfLocalDate: targetDate,
      }),
      this.getAlertStatuses(tenant.businessId),
    ]);

    return { items, alertStatuses };
  }

  private async getAlertStatuses(
    businessId: string,
  ): Promise<DashboardAlertStatusDto[]> {
    return this.withReadOnlyQueryRunner(async (queryRunner) => {
      const rows = (await queryRunner.query(
        `
          SELECT
            anomaly_key AS "anomalyKey",
            anomaly_type AS "anomalyType",
            status AS "status",
            sent_at AS "sentAt",
            updated_at AS "updatedAt"
          FROM anomaly_alerts
          WHERE business_id = $1
          ORDER BY updated_at DESC, id DESC
          LIMIT 50
        `,
        [businessId],
      )) as AlertStatusRow[];

      return rows.map((row) => ({
        anomalyKey: row.anomalyKey,
        anomalyType: row.anomalyType,
        status: row.status,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
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
}

function normalizeOverviewSelection(
  query: DashboardOverviewQuery,
  timezone: string,
): DashboardPeriodSelectionDto {
  const period = normalizePeriodSelection(query, timezone);
  return {
    ...period,
    accountId: blankToUndefined(query.accountId),
    limit: normalizeLimit(query.limit),
    offset: normalizeOffset(query.offset),
    asOfLocalDate: query.asOfLocalDate ?? period.to,
  };
}

function normalizePeriodSelection(
  query: DashboardPeriodQuery,
  timezone: string,
): Pick<DashboardPeriodSelectionDto, 'from' | 'to' | 'granularity'> {
  const today = todayInTimezone(timezone);
  const from = query.from ?? addLocalDays(today, -29);
  const to = query.to ?? today;
  computeReportPeriod(from, to, timezone);
  if (localDateSpanDays(from, to) > MAX_PERIOD_DAYS) {
    throw new BadRequestException(
      `dashboard period cannot exceed ${MAX_PERIOD_DAYS} days`,
    );
  }
  return {
    from,
    to,
    granularity: normalizeGranularity(query.granularity),
  };
}

function normalizeGranularity(raw?: string): AnalyticsGranularity {
  if (!raw) return 'day';
  if (raw === 'day' || raw === 'week' || raw === 'month') return raw;
  throw new BadRequestException('granularity must be day, week, or month');
}

function normalizeLimit(raw?: string): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  return parseStrictInteger(raw, 'limit', 1, MAX_LIMIT);
}

function normalizeOffset(raw?: string): number {
  if (raw === undefined) return 0;
  return parseStrictInteger(raw, 'offset', 0, MAX_OFFSET);
}

function parseStrictInteger(
  raw: string,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/.test(raw)) {
    throw new BadRequestException(
      `${field} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new BadRequestException(
      `${field} must be an integer from ${minimum} to ${maximum}`,
    );
  }
  return value;
}

function blankToUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function todayInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;
}

function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function localDateSpanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

function buildChartScales(
  cashPoints: Array<{ label: string; cashBalance: { amountMinor: string } }>,
  incomePoints: Array<{
    label: string;
    revenue: { amountMinor: string };
    expenses: { amountMinor: string };
  }>,
  spendAccounts: Array<{
    accountCode: string;
    accountName: string;
    expense: { amountMinor: string };
  }>,
): DashboardChartScalesDto {
  const cashMax = maxAbs(
    cashPoints.map((point) => point.cashBalance.amountMinor),
  );
  const incomeMax = maxAbs(
    incomePoints.flatMap((point) => [
      point.revenue.amountMinor,
      point.expenses.amountMinor,
    ]),
  );
  const spendMax = maxAbs(
    spendAccounts.map((account) => account.expense.amountMinor),
  );

  return {
    cashBalance: cashPoints.map((point) =>
      toChartPoint(point.label, point.cashBalance.amountMinor, cashMax),
    ),
    incomeVsExpenses: incomePoints.map((point) =>
      toChartPoint(
        point.label,
        point.revenue.amountMinor,
        incomeMax,
        point.expenses.amountMinor,
      ),
    ),
    spendByAccount: spendAccounts.map((account) =>
      toChartPoint(
        `${account.accountCode} ${account.accountName}`,
        account.expense.amountMinor,
        spendMax,
      ),
    ),
  };
}

function buildKpis(
  accountStatement: { total: number; accountCode: string } | null,
): DashboardKpiDto {
  return {
    transactionCount: accountStatement?.total ?? 0,
    transactionCountLabel: accountStatement
      ? `${accountStatement.accountCode} money movements`
      : 'No account selected',
  };
}

function toChartPoint(
  label: string,
  value: string,
  max: bigint,
  secondaryValue?: string,
) {
  const valuePermille = toPermille(value, max);
  const secondaryValuePermille =
    secondaryValue === undefined ? undefined : toPermille(secondaryValue, max);
  return {
    label,
    valuePermille,
    valuePercent: formatPermillePercent(valuePermille),
    ...(secondaryValuePermille === undefined
      ? {}
      : {
          secondaryValuePermille,
          secondaryValuePercent: formatPermillePercent(secondaryValuePermille),
        }),
  };
}

function maxAbs(values: string[]): bigint {
  return values.reduce((max, value) => {
    const parsed = BigInt(value);
    const absolute = parsed < 0n ? -parsed : parsed;
    return absolute > max ? absolute : max;
  }, 0n);
}

function toPermille(value: string, max: bigint): number {
  if (max === 0n) return 0;
  const parsed = BigInt(value);
  const absolute = parsed < 0n ? -parsed : parsed;
  return Number((absolute * 1000n) / max);
}

function formatPermillePercent(valuePermille: number): string {
  const bounded = Math.max(0, Math.min(1000, Math.trunc(valuePermille)));
  const whole = Math.floor(bounded / 10);
  const tenth = bounded % 10;
  return `${whole}.${tenth}`;
}
