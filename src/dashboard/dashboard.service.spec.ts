import { DataSource, QueryRunner } from 'typeorm';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { ReportsService } from '../reports/reports.service';
import { DashboardTenantContextDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

const tenant: DashboardTenantContextDto = {
  businessId: 'dashboard-business',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL',
  productionReady: true,
};

describe('DashboardService', () => {
  it('scopes cash position to the trusted tenant', async () => {
    const getCashPosition = jest.fn().mockResolvedValue({ netCash: {} });
    const service = new DashboardService(
      { getCashPosition } as unknown as ReportsService,
      {} as AnalyticsService,
      {} as AnomalyService,
      {} as DataSource,
    );

    await service.getCashPosition(tenant);

    expect(getCashPosition).toHaveBeenCalledWith({
      businessId: 'dashboard-business',
      currency: 'ZAR',
    });
  });

  it('reads alert metadata inside a read-only transaction', async () => {
    const detectAnomalies = jest.fn().mockResolvedValue([]);
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
        {
          anomalyKey: 'anomaly:v1:test',
          anomalyType: 'SALES_SPIKE',
          status: 'SENT',
          sentAt: new Date('2026-07-30T10:00:00.000Z'),
          updatedAt: new Date('2026-07-30T10:01:00.000Z'),
        },
      ]);
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query,
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      isTransactionActive: true,
      isReleased: false,
    } as unknown as QueryRunner;
    const service = new DashboardService(
      {} as ReportsService,
      {} as AnalyticsService,
      { detectAnomalies } as unknown as AnomalyService,
      {
        createQueryRunner: () => queryRunner,
      } as unknown as DataSource,
    );

    const result = await service.getCurrentAnomalies(tenant, '2026-07-30');

    expect(detectAnomalies).toHaveBeenCalledWith({
      businessId: 'dashboard-business',
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      asOfLocalDate: '2026-07-30',
    });
    const calls = query.mock.calls as Array<[string, unknown[]?]>;
    expect(calls[0]?.[0]).toBe('SET TRANSACTION READ ONLY');
    expect(calls[1]?.[0]).toContain('FROM anomaly_alerts');
    expect(calls[1]?.[1]).toEqual(['dashboard-business']);
    expect(result.alertStatuses).toEqual([
      {
        anomalyKey: 'anomaly:v1:test',
        anomalyType: 'SALES_SPIKE',
        status: 'SENT',
        sentAt: '2026-07-30T10:00:00.000Z',
        updatedAt: '2026-07-30T10:01:00.000Z',
      },
    ]);
  });

  it('rejects unbounded periods and offsets before calling read services', () => {
    const getIncomeStatement = jest.fn();
    const service = new DashboardService(
      { getIncomeStatement } as unknown as ReportsService,
      {} as AnalyticsService,
      {} as AnomalyService,
      {} as DataSource,
    );

    expect(() =>
      service.getIncomeStatement(tenant, {
        from: '2020-01-01',
        to: '2026-01-01',
      }),
    ).toThrow('report period cannot exceed 366 days');
    expect(getIncomeStatement).not.toHaveBeenCalled();

    expect(() =>
      service.getAccountStatement(tenant, 'account-1', {
        from: '2026-01-01',
        to: '2026-01-31',
        offset: '10001',
      }),
    ).toThrow('offset must be an integer');
  });

  it.each([
    ['limit', { limit: '' }],
    ['limit', { limit: '3.5' }],
    ['limit', { limit: '1e2' }],
    ['limit', { limit: '101' }],
    ['limit', { limit: '-1' }],
    ['offset', { offset: '' }],
    ['offset', { offset: '2.5' }],
    ['offset', { offset: '1e2' }],
  ])('rejects malformed or out-of-range %s values', (_field, query) => {
    const service = new DashboardService(
      {} as ReportsService,
      {} as AnalyticsService,
      {} as AnomalyService,
      {} as DataSource,
    );

    expect(() =>
      service.getAccountStatement(tenant, 'account-1', {
        from: '2026-01-01',
        to: '2026-01-31',
        ...query,
      }),
    ).toThrow('must be an integer');
  });
});
