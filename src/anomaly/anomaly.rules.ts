import { toMoneyDto } from '../reports/reports.math';
import { DetectedAnomalyDto } from './anomaly.dto';

export interface DailyLedgerTotals {
  localDate: string;
  revenueMinor: string;
  expensesMinor: string;
}

export interface ExpenseCandidate {
  transactionId: string;
  description: string;
  occurredAt: string;
  amountMinor: string;
}

export interface DetectionContext {
  businessId: string;
  currency: string;
  timezone: string;
  asOfLocalDate: string;
  detectedAt: string;
}

export interface AnomalyThresholds {
  largeExpenseLookbackDays: number;
  largeExpenseMinimumBaselineDays: number;
  largeExpenseMultiple: bigint;
  largeExpenseAbsoluteFloorMinor: string;
  salesLookbackDays: number;
  salesMinimumActiveDays: number;
  salesSpikeMultiple: bigint;
  salesDropDenominator: bigint;
  salesMinimumBaselineAverageMinor: string;
  salesMinimumSpikeDeltaMinor: string;
  activityGapDays: number;
  activityMinimumBaselineActiveDays: number;
}

export const DEFAULT_ANOMALY_THRESHOLDS: AnomalyThresholds = {
  largeExpenseLookbackDays: 30,
  largeExpenseMinimumBaselineDays: 5,
  largeExpenseMultiple: 3n,
  largeExpenseAbsoluteFloorMinor: '50000',
  salesLookbackDays: 14,
  salesMinimumActiveDays: 7,
  salesSpikeMultiple: 2n,
  salesDropDenominator: 2n,
  salesMinimumBaselineAverageMinor: '100000',
  salesMinimumSpikeDeltaMinor: '20000',
  activityGapDays: 3,
  activityMinimumBaselineActiveDays: 8,
};

export function detectLargeExpenseAnomalies(
  candidates: ExpenseCandidate[],
  dailyTotals: DailyLedgerTotals[],
  context: DetectionContext,
  thresholds = DEFAULT_ANOMALY_THRESHOLDS,
): DetectedAnomalyDto[] {
  const baseline = dailyTotals
    .filter((day) => day.localDate < context.asOfLocalDate)
    .slice(-thresholds.largeExpenseLookbackDays)
    .map((day) => toMinor(day.expensesMinor))
    .filter((amount) => amount > 0n);

  if (baseline.length < thresholds.largeExpenseMinimumBaselineDays) {
    return [];
  }

  const baselineTotal = baseline.reduce((sum, amount) => sum + amount, 0n);
  const baselineAverage = baselineTotal / BigInt(baseline.length);
  const absoluteFloor = toMinor(thresholds.largeExpenseAbsoluteFloorMinor);

  return candidates.flatMap((candidate) => {
    const amount = toMinor(candidate.amountMinor);
    const meetsMultiple =
      amount * BigInt(baseline.length) >=
      baselineTotal * thresholds.largeExpenseMultiple;
    const meetsFloor = amount >= absoluteFloor;
    if (!meetsMultiple || !meetsFloor) {
      return [];
    }

    return [
      {
        key: `anomaly:v1:large-expense:${context.businessId}:${context.currency}:${candidate.transactionId}`,
        type: 'LARGE_EXPENSE',
        severity: 'WARNING',
        businessId: context.businessId,
        currency: context.currency,
        timezone: context.timezone,
        detectedAt: context.detectedAt,
        title: 'Unusually large expense',
        summary: `A posted expense is unusually large for ${context.asOfLocalDate}.`,
        explanation: `Rule: single active posted expense is at least 3x the prior active-day expense baseline and at least ${
          toMoneyDto(
            thresholds.largeExpenseAbsoluteFloorMinor,
            context.currency,
          ).formatted
        }.`,
        period: {
          fromLocalDate: context.asOfLocalDate,
          toLocalDate: context.asOfLocalDate,
        },
        figures: [
          {
            label: 'Expense',
            value: toMoneyDto(candidate.amountMinor, context.currency),
          },
          {
            label: 'Baseline average',
            value: toMoneyDto(baselineAverage.toString(), context.currency),
          },
        ],
        metadata: {
          transactionId: candidate.transactionId,
          description: candidate.description,
          occurredAt: candidate.occurredAt,
          baselineActiveExpenseDays: baseline.length.toString(),
          baselineTotalMinor: baselineTotal.toString(),
          threshold: '3x active expense baseline and absolute floor',
        },
      } satisfies DetectedAnomalyDto,
    ];
  });
}

export function detectSalesVolumeAnomalies(
  dailyTotals: DailyLedgerTotals[],
  context: DetectionContext,
  thresholds = DEFAULT_ANOMALY_THRESHOLDS,
): DetectedAnomalyDto[] {
  const target = dailyTotals.find(
    (day) => day.localDate === context.asOfLocalDate,
  );
  if (!target) return [];

  const baseline = dailyTotals
    .filter((day) => day.localDate < context.asOfLocalDate)
    .slice(-thresholds.salesLookbackDays);
  if (baseline.length < thresholds.salesLookbackDays) return [];

  const baselineSales = baseline.map((day) => toMinor(day.revenueMinor));
  const activeDays = baselineSales.filter((amount) => amount > 0n).length;
  if (activeDays < thresholds.salesMinimumActiveDays) return [];

  const baselineTotal = baselineSales.reduce((sum, amount) => sum + amount, 0n);
  const baselineAverage = baselineTotal / BigInt(baseline.length);
  if (baselineAverage < toMinor(thresholds.salesMinimumBaselineAverageMinor)) {
    return [];
  }

  const targetSales = toMinor(target.revenueMinor);
  const anomalies: DetectedAnomalyDto[] = [];
  const targetBeatsSpikeThreshold =
    targetSales * BigInt(baseline.length) >=
    baselineTotal * thresholds.salesSpikeMultiple;
  const spikeDelta = targetSales - baselineAverage;
  if (
    targetBeatsSpikeThreshold &&
    spikeDelta >= toMinor(thresholds.salesMinimumSpikeDeltaMinor)
  ) {
    anomalies.push(
      salesAnomaly(
        'SALES_SPIKE',
        'Sudden sales spike',
        `Sales were at least 2x the recent rolling baseline for ${context.asOfLocalDate}.`,
        targetSales,
        baselineAverage,
        activeDays,
        baselineTotal,
        context,
      ),
    );
  }

  const targetFallsBelowDropThreshold =
    targetSales * BigInt(baseline.length) * thresholds.salesDropDenominator <=
    baselineTotal;
  if (targetFallsBelowDropThreshold) {
    anomalies.push(
      salesAnomaly(
        'SALES_DROP',
        'Sudden sales drop',
        `Sales were at most 50% of the recent rolling baseline for ${context.asOfLocalDate}.`,
        targetSales,
        baselineAverage,
        activeDays,
        baselineTotal,
        context,
      ),
    );
  }

  return anomalies;
}

export function detectActivityGapAnomaly(
  dailyTotals: DailyLedgerTotals[],
  context: DetectionContext,
  thresholds = DEFAULT_ANOMALY_THRESHOLDS,
): DetectedAnomalyDto | null {
  const targetIndex = dailyTotals.findIndex(
    (day) => day.localDate === context.asOfLocalDate,
  );
  if (targetIndex < thresholds.activityGapDays - 1) return null;

  const gapDays = dailyTotals.slice(
    targetIndex - thresholds.activityGapDays + 1,
    targetIndex + 1,
  );
  if (gapDays.length !== thresholds.activityGapDays) return null;
  if (gapDays.some((day) => toMinor(day.revenueMinor) > 0n)) return null;

  const baseline = dailyTotals.slice(
    0,
    targetIndex - thresholds.activityGapDays + 1,
  );
  const activeDays = baseline.filter((day) => toMinor(day.revenueMinor) > 0n);
  if (activeDays.length < thresholds.activityMinimumBaselineActiveDays) {
    return null;
  }

  const fromLocalDate = gapDays[0].localDate;
  const toLocalDate = gapDays[gapDays.length - 1].localDate;

  return {
    key: `anomaly:v1:activity-gap:${context.businessId}:${context.currency}:${fromLocalDate}:${toLocalDate}`,
    type: 'ACTIVITY_GAP',
    severity: 'INFO',
    businessId: context.businessId,
    currency: context.currency,
    timezone: context.timezone,
    detectedAt: context.detectedAt,
    title: 'Unusual sales gap',
    summary: `No sales were recorded from ${fromLocalDate} to ${toLocalDate}.`,
    explanation: `Rule: no sales for ${thresholds.activityGapDays} days after at least ${thresholds.activityMinimumBaselineActiveDays} active sales days in the recent baseline window.`,
    period: { fromLocalDate, toLocalDate },
    figures: [],
    metadata: {
      gapDays: thresholds.activityGapDays.toString(),
      baselineActiveSalesDays: activeDays.length.toString(),
      baselineWindowDays: baseline.length.toString(),
    },
  };
}

export function buildAlertBody(anomaly: DetectedAnomalyDto): string {
  const figureLines = anomaly.figures
    .map((figure) => `${figure.label}: ${figure.value.formatted}`)
    .join('\n');
  const details =
    anomaly.type === 'ACTIVITY_GAP'
      ? `Active sales days before this gap: ${anomaly.metadata.baselineActiveSalesDays ?? '0'}`
      : figureLines;

  return [
    `KasiCash alert: ${anomaly.title}`,
    anomaly.summary,
    details,
    anomaly.explanation,
    'Please check the underlying transactions before acting.',
  ]
    .filter(Boolean)
    .join('\n');
}

function salesAnomaly(
  type: 'SALES_SPIKE' | 'SALES_DROP',
  title: string,
  summary: string,
  targetSales: bigint,
  baselineAverage: bigint,
  activeDays: number,
  baselineTotal: bigint,
  context: DetectionContext,
): DetectedAnomalyDto {
  const slug = type === 'SALES_SPIKE' ? 'sales-spike' : 'sales-drop';
  return {
    key: `anomaly:v1:${slug}:${context.businessId}:${context.currency}:${context.asOfLocalDate}`,
    type,
    severity: 'WARNING',
    businessId: context.businessId,
    currency: context.currency,
    timezone: context.timezone,
    detectedAt: context.detectedAt,
    title,
    summary,
    explanation:
      type === 'SALES_SPIKE'
        ? 'Rule: target-day sales are at least 2x the prior 14-day rolling average, with enough active baseline days.'
        : 'Rule: target-day sales are at most 50% of the prior 14-day rolling average, with enough active baseline days.',
    period: {
      fromLocalDate: context.asOfLocalDate,
      toLocalDate: context.asOfLocalDate,
    },
    figures: [
      {
        label: 'Target sales',
        value: toMoneyDto(targetSales.toString(), context.currency),
      },
      {
        label: 'Baseline average',
        value: toMoneyDto(baselineAverage.toString(), context.currency),
      },
    ],
    metadata: {
      baselineActiveSalesDays: activeDays.toString(),
      baselineTotalMinor: baselineTotal.toString(),
      threshold:
        type === 'SALES_SPIKE'
          ? '2x rolling sales baseline'
          : '50% rolling sales baseline',
    },
  };
}

function toMinor(value: string): bigint {
  if (!/^-?\d+$/.test(value)) {
    throw new Error('minor-unit money must be an integer string');
  }
  return BigInt(value);
}
