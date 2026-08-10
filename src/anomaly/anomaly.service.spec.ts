import { DataSource, QueryRunner } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import type { WhatsAppClient } from '../ingestion/whatsapp.client';
import { AnomalyService } from './anomaly.service';

type QueryMock = jest.Mock<Promise<unknown>, [string, unknown[]?]>;
type MockQueryRunner = Omit<QueryRunner, 'query'> & { query: QueryMock };

describe('AnomalyService', () => {
  it('detects anomalies with read-only single-expense SQL scoped by business', async () => {
    const analytics = analyticsWithSeries();
    const expenseRunner = detectionRunner([
      {
        transactionId: 'tx-big',
        description: 'stock buy',
        occurredAt: '2026-07-31T10:00:00.000Z',
        amountMinor: '60000',
      },
    ]);
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(expenseRunner),
    } as unknown as DataSource;
    const service = new AnomalyService(dataSource, analytics, waClient());

    const anomalies = await service.detectAnomalies({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });

    const calls = expenseRunner.query.mock.calls;
    const sql = String(calls[2]?.[0]);
    expect(calls[0]?.[0]).toBe('SET TRANSACTION READ ONLY');
    expect(String(calls[1]?.[0])).toContain('FROM supported_currencies');
    expect(sql).toContain('WHERE t.business_id = $1');
    expect(sql).toContain("t.status = 'POSTED'");
    expect(sql).toContain('t.reversal_of_transaction_id IS NULL');
    expect(sql).toContain("a.code = '500' OR a.code LIKE '500.%'");
    expect(sql).toContain("timezone('UTC', t.occurred_at)");
    expect(sql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE)\b/i,
    );
    expect(calls[2]?.[1]).toEqual([
      'b-1',
      'ZAR',
      '2026-07-30T22:00:00.000Z',
      '2026-07-31T22:00:00.000Z',
    ]);
    expect(anomalies.map((anomaly) => anomaly.type)).toContain('LARGE_EXPENSE');
    expect(anomalies.every((anomaly) => anomaly.businessId === 'b-1')).toBe(
      true,
    );
  });

  it('dispatches the same anomaly only once', async () => {
    const analytics = analyticsWithSeries();
    const dataSourceQuery: QueryMock = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValueOnce([{ id: 'alert-1', attempts: 1 }])
      .mockResolvedValueOnce([{ id: 'alert-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const sendText = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(
          readOnlyRunner([{ id: 'b-1', waPhone: '27830000000' }]),
        )
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(
          readOnlyRunner([{ id: 'b-1', waPhone: '27830000000' }]),
        ),
      query: dataSourceQuery,
    } as unknown as DataSource;
    const service = new AnomalyService(dataSource, analytics, { sendText });

    const first = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });
    const second = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });

    expect(first.sent).toBe(1);
    expect(second.skipped).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(String(dataSourceQuery.mock.calls[0]?.[0])).toContain(
      'INSERT INTO anomaly_alerts',
    );
    expect(String(dataSourceQuery.mock.calls[2]?.[0])).toContain(
      "SET status = 'SENT'",
    );
  });

  it('fails safe when a business has no WhatsApp recipient', async () => {
    const dataSourceQuery = jest.fn<Promise<unknown>, [string, unknown[]?]>();
    const dataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(readOnlyRunner([{ id: 'b-1', waPhone: null }])),
      query: dataSourceQuery,
    } as unknown as DataSource;
    const wa = waClient();
    const service = new AnomalyService(dataSource, analyticsWithSeries(), wa);

    const result = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });

    expect(result.results[0].status).toBe('NO_RECIPIENT');
    expect(wa.sendText.mock.calls).toHaveLength(0);
    expect(dataSourceQuery).not.toHaveBeenCalled();
  });

  it('records ambiguous sends once and never automatically retries them', async () => {
    const dataSourceQuery: QueryMock = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValueOnce([{ id: 'alert-1', attempts: 1 }])
      .mockResolvedValueOnce([{ id: 'alert-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const sendText = jest
      .fn()
      .mockRejectedValue(new Error('private provider payload R999.99'));
    const dataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(
          readOnlyRunner([{ id: 'b-1', waPhone: '27830000000' }]),
        )
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(
          readOnlyRunner([{ id: 'b-1', waPhone: '27830000000' }]),
        ),
      query: dataSourceQuery,
    } as unknown as DataSource;
    const service = new AnomalyService(dataSource, analyticsWithSeries(), {
      sendText,
    });

    const first = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });
    const second = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });

    expect(first.failed).toBe(1);
    expect(second.skipped).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(String(dataSourceQuery.mock.calls[2]?.[0])).toContain(
      "SET status = 'DELIVERY_UNCERTAIN'",
    );
    for (const [sql] of dataSourceQuery.mock.calls) {
      expect(String(sql)).not.toMatch(
        /\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?(transactions|entries|accounts)\b/i,
      );
    }
  });

  it('fails closed when provider success cannot be recorded for later reconciliation', async () => {
    const dataSourceQuery: QueryMock = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValueOnce([{ id: 'alert-1', attempts: 1 }])
      .mockResolvedValueOnce([{ id: 'alert-1' }])
      .mockRejectedValueOnce(new Error('mark sent unavailable'))
      .mockRejectedValueOnce(new Error('mark uncertain unavailable'));
    const sendText = jest.fn().mockResolvedValue(undefined);
    const dataSource = {
      createQueryRunner: jest
        .fn()
        .mockReturnValueOnce(detectionRunner([expenseRow()]))
        .mockReturnValueOnce(
          readOnlyRunner([{ id: 'b-1', waPhone: '27830000000' }]),
        ),
      query: dataSourceQuery,
    } as unknown as DataSource;
    const service = new AnomalyService(dataSource, analyticsWithSeries(), {
      sendText,
    });

    const result = await service.dispatchAlerts({
      businessId: 'b-1',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-31',
      currency: 'ZAR',
    });

    expect(result.failed).toBe(1);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(String(dataSourceQuery.mock.calls[2]?.[0])).toContain(
      "SET status = 'SENT'",
    );
    expect(String(dataSourceQuery.mock.calls[3]?.[0])).toContain(
      "SET status = 'DELIVERY_UNCERTAIN'",
    );
  });
});

function analyticsWithSeries(): AnalyticsService {
  return {
    getIncomeVsExpensesSeries: jest.fn().mockResolvedValue({
      points: [
        ...Array.from({ length: 30 }, (_, index) => ({
          label: `2026-07-${(index + 1).toString().padStart(2, '0')}`,
          revenue: { amountMinor: '100000' },
          expenses: { amountMinor: index < 10 ? '10000' : '0' },
        })),
        {
          label: '2026-07-31',
          revenue: { amountMinor: '100000' },
          expenses: { amountMinor: '60000' },
        },
      ],
    }),
  } as unknown as AnalyticsService;
}

function expenseRow() {
  return {
    transactionId: 'tx-big',
    description: 'stock buy',
    occurredAt: '2026-07-31T10:00:00.000Z',
    amountMinor: '60000',
  };
}

function readOnlyRunner(rows: unknown[]): MockQueryRunner {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isReleased: false,
    isTransactionActive: true,
    query: jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(rows),
  } as MockQueryRunner;
}

function detectionRunner(rows: unknown[]): MockQueryRunner {
  const runner = readOnlyRunner(rows);
  runner.query
    .mockReset()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([
      {
        largeExpenseFloorMinor: '50000',
        salesBaselineFloorMinor: '100000',
        salesSpikeDeltaMinor: '20000',
      },
    ])
    .mockResolvedValueOnce(rows);
  return runner;
}

function waClient(): WhatsAppClient & { sendText: jest.Mock } {
  return { sendText: jest.fn().mockResolvedValue(undefined) };
}
