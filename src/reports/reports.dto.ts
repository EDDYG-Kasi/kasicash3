export interface MoneyDto {
  amountMinor: string;
  formatted: string;
  currency: string;
}

export interface ReportPeriodDto {
  fromLocalDate: string;
  toLocalDate: string;
  timezone: string;
  startUtc: string;
  endUtcExclusive: string;
}

export interface AccountBalanceDto {
  accountId: string;
  code: string;
  name: string;
  type: string;
  isCash: boolean;
  balance: MoneyDto;
}

export interface CashPositionReportDto {
  businessId: string;
  currency: string;
  generatedAt: string;
  netCash: MoneyDto;
  accounts: AccountBalanceDto[];
}

export interface IncomeStatementReportDto {
  businessId: string;
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  revenue: MoneyDto;
  expenses: MoneyDto;
  netIncome: MoneyDto;
}

export interface AccountStatementLineDto {
  transactionId: string;
  occurredAt: string;
  postedAt: string;
  description: string;
  delta: MoneyDto;
  runningBalance: MoneyDto;
}

export interface AccountStatementReportDto {
  businessId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  currency: string;
  generatedAt: string;
  period: ReportPeriodDto;
  openingBalance: MoneyDto;
  limit: number;
  offset: number;
  total: number;
  lines: AccountStatementLineDto[];
}

export interface ReportCurrencyInput {
  currency?: string;
}

export interface PeriodReportInput extends ReportCurrencyInput {
  from: string;
  to: string;
  timezone?: string;
}

export interface CashPositionInput extends ReportCurrencyInput {
  businessId: string;
}

export interface IncomeStatementInput extends PeriodReportInput {
  businessId: string;
}

export interface AccountStatementInput extends PeriodReportInput {
  businessId: string;
  accountId: string;
  limit?: number;
  offset?: number;
}
