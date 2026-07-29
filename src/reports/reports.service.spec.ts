import { DataSource, QueryRunner } from 'typeorm';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('runs cash position inside a read-only transaction and scopes posted-history rows by business', async () => {
    const query: jest.MockedFunction<
      (sql: string, parameters?: unknown[]) => Promise<unknown>
    > = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          accountId: 'cash',
          code: '100',
          name: 'Cash',
          type: 'ASSET',
          isCash: true,
          balanceMinor: '7500',
        },
      ]);
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
    const service = new ReportsService({
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource);

    const report = await service.getCashPosition({
      businessId: 'b-1',
      currency: 'ZAR',
    });

    expect(connect).toHaveBeenCalled();
    expect(startTransaction).toHaveBeenCalled();
    expect(query.mock.calls[0]?.[0]).toBe('SET TRANSACTION READ ONLY');
    expect(query.mock.calls[1]?.[0]).toContain(
      "t.status IN ('POSTED', 'REVERSED')",
    );
    expect(query.mock.calls[1]?.[0]).toContain('WHERE a.business_id = $1');
    expect(query.mock.calls[1]?.[1]).toEqual(['b-1', 'ZAR']);
    expect(commitTransaction).toHaveBeenCalled();
    expect(report.netCash.amountMinor).toBe('7500');
  });
});
