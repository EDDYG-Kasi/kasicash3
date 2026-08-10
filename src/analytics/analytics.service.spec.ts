import { DataSource, QueryRunner } from 'typeorm';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('returns cash balance buckets from a read-only, tenant-scoped posted-history query', async () => {
    const { service, query, connect, startTransaction, commitTransaction } =
      createService([
        {
          label: '2026-07-06',
          bucketStartLocal: '2026-07-06T00:00:00.000',
          bucketStartUtc: '2026-07-05T22:00:00.000Z',
          bucketEndUtcExclusive: '2026-07-06T22:00:00.000Z',
          cashDeltaMinor: '2500',
          cashBalanceMinor: '90071992547409931234',
        },
      ]);

    const report = await service.getCashBalanceSeries({
      businessId: 'b-1',
      from: '2026-07-06',
      to: '2026-07-06',
      timezone: 'Africa/Johannesburg',
      granularity: 'day',
      currency: 'ZAR',
    });

    const sql = String(query.mock.calls[1]?.[0]);
    expect(connect).toHaveBeenCalled();
    expect(startTransaction).toHaveBeenCalled();
    expect(query.mock.calls[0]?.[0]).toBe('SET TRANSACTION READ ONLY');
    expect(sql).toContain("t.status IN ('POSTED', 'REVERSED')");
    expect(sql).toContain('WHERE e.business_id = $1');
    expect(sql).toContain('timezone($4, $5::timestamptz)');
    expect(sql).toContain("a.code = '100' OR a.code LIKE '100.%'");
    expectNoMutationSql(sql);
    expect(query.mock.calls[1]?.[1]).toEqual([
      'b-1',
      'ZAR',
      'day',
      'Africa/Johannesburg',
      '2026-07-05T22:00:00.000Z',
      '2026-07-06T21:59:59.999Z',
      '1 day',
      '2026-07-06T22:00:00.000Z',
    ]);
    expect(commitTransaction).toHaveBeenCalled();
    expect(report.points[0]).toMatchObject({
      label: '2026-07-06',
      cashDelta: { amountMinor: '2500', formatted: 'ZAR 25.00' },
      cashBalance: {
        amountMinor: '90071992547409931234',
        formatted: 'ZAR 900719925474099312.34',
      },
    });
  });

  it('returns income, expense, and net-income buckets without resolver-provided figures', async () => {
    const { service, query } = createService([
      {
        label: '2026-W28',
        bucketStartLocal: '2026-07-06T00:00:00.000',
        bucketStartUtc: '2026-07-05T22:00:00.000Z',
        bucketEndUtcExclusive: '2026-07-12T22:00:00.000Z',
        revenueMinor: '10000',
        expensesMinor: '2500',
      },
    ]);

    const report = await service.getIncomeVsExpensesSeries({
      businessId: 'b-1',
      from: '2026-07-06',
      to: '2026-07-12',
      timezone: 'Africa/Johannesburg',
      granularity: 'week',
      currency: 'ZAR',
    });

    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toContain("t.status IN ('POSTED', 'REVERSED')");
    expect(sql).toContain('WHERE e.business_id = $1');
    expect(sql).toContain("a.code = '400'");
    expect(sql).toContain("a.code = '500'");
    expectNoMutationSql(sql);
    expect(report.points[0]).toMatchObject({
      revenue: { amountMinor: '10000' },
      expenses: { amountMinor: '2500' },
      netIncome: { amountMinor: '7500' },
    });
  });

  it('returns spend breakdown totals from account-grouped expense rows', async () => {
    const { service, query } = createService([
      {
        accountId: 'expense-stock',
        accountCode: '500.10',
        accountName: 'Stock',
        expenseMinor: '3000',
      },
      {
        accountId: 'expense-rent',
        accountCode: '500.20',
        accountName: 'Rent',
        expenseMinor: '-500',
      },
    ]);

    const report = await service.getSpendByAccountBreakdown({
      businessId: 'b-1',
      from: '2026-07-01',
      to: '2026-07-31',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
    });

    const sql = String(query.mock.calls[1]?.[0]);
    expect(sql).toContain("t.status IN ('POSTED', 'REVERSED')");
    expect(sql).toContain('WHERE e.business_id = $1');
    expect(sql).toContain("a.code = '500' OR a.code LIKE '500.%'");
    expectNoMutationSql(sql);
    expect(report.totalExpenses.amountMinor).toBe('2500');
    expect(report.accounts.map((row) => row.expense.amountMinor)).toEqual([
      '3000',
      '-500',
    ]);
  });

  it('rolls back and releases the read-only transaction on query failure', async () => {
    const query: jest.MockedFunction<
      (sql: string, parameters?: unknown[]) => Promise<unknown>
    > = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('database read failed'));
    const rollbackTransaction = jest.fn();
    const release = jest.fn();
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction,
      release,
      isReleased: false,
      isTransactionActive: true,
      query,
    } as unknown as QueryRunner;
    const service = new AnalyticsService({
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource);

    await expect(
      service.getCashBalanceSeries({
        businessId: 'b-1',
        from: '2026-07-06',
        to: '2026-07-06',
        timezone: 'Africa/Johannesburg',
        granularity: 'day',
      }),
    ).rejects.toThrow('database read failed');

    expect(rollbackTransaction).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });
});

function createService(rows: unknown[]) {
  const query: jest.MockedFunction<
    (sql: string, parameters?: unknown[]) => Promise<unknown>
  > = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(rows);
  const connect = jest.fn();
  const startTransaction = jest.fn();
  const commitTransaction = jest.fn();
  const queryRunner = {
    connect,
    startTransaction,
    commitTransaction,
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isReleased: false,
    isTransactionActive: true,
    query,
  } as unknown as QueryRunner;
  const service = new AnalyticsService({
    createQueryRunner: jest.fn().mockReturnValue(queryRunner),
  } as unknown as DataSource);

  return { service, query, connect, startTransaction, commitTransaction };
}

function expectNoMutationSql(sql: string): void {
  expect(sql).not.toMatch(
    /\b(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE)\b/i,
  );
}
