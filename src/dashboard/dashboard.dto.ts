import {
  CashBalanceSeriesDto,
  IncomeExpenseSeriesDto,
  SpendByAccountBreakdownDto,
} from '../analytics/analytics.dto';
import { DetectedAnomalyDto } from '../anomaly/anomaly.dto';
import {
  AccountStatementReportDto,
  CashPositionReportDto,
  IncomeStatementReportDto,
} from '../reports/reports.dto';

export type DashboardAuthBoundary = 'PHASE_9_AUTHENTICATED_PRINCIPAL';

export interface DashboardTenantContextDto {
  businessId: string;
  currency: string;
  timezone: string;
  authBoundary: DashboardAuthBoundary;
  productionReady: true;
}

export interface DashboardPeriodSelectionDto {
  from: string;
  to: string;
  granularity: 'day' | 'week' | 'month';
  accountId?: string;
  limit: number;
  offset: number;
  asOfLocalDate: string;
}

export interface DashboardChartPointDto {
  label: string;
  valuePermille: number;
  secondaryValuePermille?: number;
}

export interface DashboardChartScalesDto {
  cashBalance: DashboardChartPointDto[];
  incomeVsExpenses: DashboardChartPointDto[];
}

export interface DashboardAlertStatusDto {
  anomalyKey: string;
  anomalyType: string;
  status: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface DashboardAnomaliesDto {
  items: DetectedAnomalyDto[];
  alertStatuses: DashboardAlertStatusDto[];
}

export interface DashboardOverviewDto {
  generatedAt: string;
  tenant: DashboardTenantContextDto;
  period: DashboardPeriodSelectionDto;
  cashPosition: CashPositionReportDto;
  incomeStatement: IncomeStatementReportDto;
  accountStatement: AccountStatementReportDto | null;
  analytics: {
    cashBalance: CashBalanceSeriesDto;
    incomeVsExpenses: IncomeExpenseSeriesDto;
    spendByAccount: SpendByAccountBreakdownDto;
    chartScales: DashboardChartScalesDto;
  };
  anomalies: DashboardAnomaliesDto;
}

export interface DashboardOverviewQuery {
  from?: string;
  to?: string;
  granularity?: string;
  accountId?: string;
  limit?: string;
  offset?: string;
  asOfLocalDate?: string;
}

export interface DashboardPeriodQuery {
  from?: string;
  to?: string;
  granularity?: string;
}

export interface DashboardStatementQuery extends DashboardPeriodQuery {
  limit?: string;
  offset?: string;
}
