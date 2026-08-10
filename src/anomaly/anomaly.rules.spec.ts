import {
  buildAlertBody,
  DailyLedgerTotals,
  detectActivityGapAnomaly,
  detectLargeExpenseAnomalies,
  detectSalesVolumeAnomalies,
  DEFAULT_ANOMALY_THRESHOLDS,
  ExpenseCandidate,
} from './anomaly.rules';

const context = {
  businessId: 'b-1',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  asOfLocalDate: '2026-07-31',
  detectedAt: '2026-07-31T21:00:00.000Z',
};

describe('anomaly rules', () => {
  it('detects a large single expense above the 3x baseline and absolute floor', () => {
    const anomalies = detectLargeExpenseAnomalies(
      [candidate('tx-big', '60000')],
      expenseBaseline('2026-07', '10000', 10),
      context,
    );

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      key: 'anomaly:v1:large-expense:b-1:ZAR:tx-big',
      type: 'LARGE_EXPENSE',
      figures: [
        { label: 'Expense', value: { amountMinor: '60000' } },
        { label: 'Baseline average', value: { amountMinor: '10000' } },
      ],
    });
  });

  it('does not detect a large expense below the multiple threshold', () => {
    const anomalies = detectLargeExpenseAnomalies(
      [candidate('tx-normal', '29999')],
      expenseBaseline('2026-07', '10000', 10),
      context,
    );

    expect(anomalies).toEqual([]);
  });

  it('detects the large-expense boundary when it is exactly 3x baseline', () => {
    const anomalies = detectLargeExpenseAnomalies(
      [candidate('tx-boundary', '50000')],
      expenseBaseline('2026-07', '16666', 10),
      context,
    );

    expect(anomalies.map((anomaly) => anomaly.key)).toEqual([
      'anomaly:v1:large-expense:b-1:ZAR:tx-boundary',
    ]);
  });

  it('does not detect a large expense without enough baseline days', () => {
    const anomalies = detectLargeExpenseAnomalies(
      [candidate('tx-big', '60000')],
      expenseBaseline('2026-07', '10000', 4),
      context,
    );

    expect(anomalies).toEqual([]);
  });

  it('uses currency-specific bigint floors rather than ZAR minor units', () => {
    const anomalies = detectLargeExpenseAnomalies(
      [candidate('tx-jpy', '600')],
      expenseBaseline('2026-07', '100', 10),
      { ...context, currency: 'JPY' },
      {
        ...DEFAULT_ANOMALY_THRESHOLDS,
        largeExpenseAbsoluteFloorMinor: '500',
        salesMinimumBaselineAverageMinor: '1000',
        salesMinimumSpikeDeltaMinor: '200',
      },
    );

    expect(anomalies[0].figures[0].value).toMatchObject({
      amountMinor: '600',
      formatted: 'JPY 600',
      currency: 'JPY',
    });
  });

  it('detects sales spike and sales drop with deterministic bigint thresholds', () => {
    const spike = detectSalesVolumeAnomalies(
      [...salesBaseline('2026-07', '100000', 14), day('2026-07-31', '250000')],
      context,
    );
    const drop = detectSalesVolumeAnomalies(
      [...salesBaseline('2026-07', '100000', 14), day('2026-07-31', '50000')],
      context,
    );

    expect(spike.map((anomaly) => anomaly.type)).toEqual(['SALES_SPIKE']);
    expect(spike[0].figures[0].value.amountMinor).toBe('250000');
    expect(spike[0].figures[1].value.amountMinor).toBe('100000');
    expect(drop.map((anomaly) => anomaly.type)).toEqual(['SALES_DROP']);
  });

  it('does not detect sales movement when reversed activity nets target sales to baseline', () => {
    const anomalies = detectSalesVolumeAnomalies(
      [...salesBaseline('2026-07', '100000', 14), day('2026-07-31', '100000')],
      context,
    );

    expect(anomalies).toEqual([]);
  });

  it('does not detect sales movement when the trader is not normally active', () => {
    const quietBaseline = [
      ...salesBaseline('2026-07', '100000', 6),
      ...zeroDays('2026-07', 7, 14),
      day('2026-07-31', '250000'),
    ];

    expect(detectSalesVolumeAnomalies(quietBaseline, context)).toEqual([]);
  });

  it('detects an activity gap for a normally active trader', () => {
    const totals = [
      ...salesBaseline('2026-07', '100000', 10),
      ...zeroDays('2026-07', 11, 28),
      day('2026-07-29', '0'),
      day('2026-07-30', '0'),
      day('2026-07-31', '0'),
    ];

    const anomaly = detectActivityGapAnomaly(totals, context);

    expect(anomaly).toMatchObject({
      key: 'anomaly:v1:activity-gap:b-1:ZAR:2026-07-29:2026-07-31',
      type: 'ACTIVITY_GAP',
      period: { fromLocalDate: '2026-07-29', toLocalDate: '2026-07-31' },
      metadata: { baselineActiveSalesDays: '10' },
    });
  });

  it('does not detect an activity gap when any gap day has sales', () => {
    const totals = [
      ...salesBaseline('2026-07', '100000', 10),
      ...zeroDays('2026-07', 11, 28),
      day('2026-07-29', '0'),
      day('2026-07-30', '100'),
      day('2026-07-31', '0'),
    ];

    expect(detectActivityGapAnomaly(totals, context)).toBeNull();
  });

  it('builds an alert body from anomaly facts without inventing new figures', () => {
    const anomaly = detectLargeExpenseAnomalies(
      [candidate('tx-big', '60000')],
      expenseBaseline('2026-07', '10000', 10),
      context,
    )[0];

    expect(buildAlertBody(anomaly)).toContain('Expense: ZAR 600.00');
    expect(buildAlertBody(anomaly)).toContain('Baseline average: ZAR 100.00');
  });
});

function candidate(
  transactionId: string,
  amountMinor: string,
): ExpenseCandidate {
  return {
    transactionId,
    description: transactionId,
    occurredAt: '2026-07-31T10:00:00.000Z',
    amountMinor,
  };
}

function expenseBaseline(
  monthPrefix: string,
  expensesMinor: string,
  days: number,
): DailyLedgerTotals[] {
  return Array.from({ length: days }, (_, index) =>
    day(
      `${monthPrefix}-${(index + 1).toString().padStart(2, '0')}`,
      '0',
      expensesMinor,
    ),
  );
}

function salesBaseline(
  monthPrefix: string,
  revenueMinor: string,
  days: number,
): DailyLedgerTotals[] {
  return Array.from({ length: days }, (_, index) =>
    day(
      `${monthPrefix}-${(index + 1).toString().padStart(2, '0')}`,
      revenueMinor,
    ),
  );
}

function zeroDays(
  monthPrefix: string,
  fromDay: number,
  toDay: number,
): DailyLedgerTotals[] {
  return Array.from({ length: toDay - fromDay + 1 }, (_, index) =>
    day(`${monthPrefix}-${(fromDay + index).toString().padStart(2, '0')}`, '0'),
  );
}

function day(
  localDate: string,
  revenueMinor: string,
  expensesMinor = '0',
): DailyLedgerTotals {
  return { localDate, revenueMinor, expensesMinor };
}
