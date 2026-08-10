import { MoneyDto, ReportPeriodDto } from '../reports/reports.dto';

export type AnalyticsGranularity = 'day' | 'week' | 'month';

export interface AnalyticsSeriesInput {
  businessId: string;
  from: string;
  to: string;
  timezone: string;
  granularity: AnalyticsGranularity;
  currency?: string;
}

export interface SpendByAccountInput {
  businessId: string;
  from: string;
  to: string;
  timezone: string;
  currency?: string;
}

export interface AnalyticsBucketDto {
  label: string;
  bucketStartLocal: string;
  bucketStartUtc: string;
  bucketEndUtcExclusive: string;
}

export interface CashBalancePointDto extends AnalyticsBucketDto {
  cashDelta: MoneyDto;
  cashBalance: MoneyDto;
}

export interface CashBalanceSeriesDto {
  businessId: string;
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  granularity: AnalyticsGranularity;
  points: CashBalancePointDto[];
}

export interface IncomeExpensePointDto extends AnalyticsBucketDto {
  revenue: MoneyDto;
  expenses: MoneyDto;
  netIncome: MoneyDto;
}

export interface IncomeExpenseSeriesDto {
  businessId: string;
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  granularity: AnalyticsGranularity;
  points: IncomeExpensePointDto[];
}

export interface SpendByAccountRowDto {
  accountId: string;
  accountCode: string;
  accountName: string;
  expense: MoneyDto;
}

export interface SpendByAccountBreakdownDto {
  businessId: string;
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  totalExpenses: MoneyDto;
  accounts: SpendByAccountRowDto[];
}
