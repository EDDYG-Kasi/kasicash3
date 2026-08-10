import { MoneyDto } from '../reports/reports.dto';

export type AnomalyType =
  'LARGE_EXPENSE' | 'SALES_SPIKE' | 'SALES_DROP' | 'ACTIVITY_GAP';

export type AnomalySeverity = 'INFO' | 'WARNING';

export type AlertDispatchStatus =
  'SENT' | 'SKIPPED' | 'FAILED' | 'NO_RECIPIENT';

export interface DetectAnomaliesInput {
  businessId: string;
  timezone: string;
  asOfLocalDate?: string;
  currency?: string;
}

export type DispatchAnomalyAlertsInput = DetectAnomaliesInput;

export interface AnomalyFigureDto {
  label: string;
  value: MoneyDto;
}

export interface DetectedAnomalyDto {
  key: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  businessId: string;
  currency: string;
  timezone: string;
  detectedAt: string;
  title: string;
  summary: string;
  explanation: string;
  period: {
    fromLocalDate: string;
    toLocalDate: string;
  };
  figures: AnomalyFigureDto[];
  metadata: Record<string, string>;
}

export interface AlertDispatchItemDto {
  anomalyKey: string;
  type: AnomalyType;
  status: AlertDispatchStatus;
  alertId?: string;
  reason?: string;
}

export interface AlertDispatchResultDto {
  businessId: string;
  detected: number;
  sent: number;
  skipped: number;
  failed: number;
  results: AlertDispatchItemDto[];
}
