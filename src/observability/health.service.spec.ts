import { DataSource } from 'typeorm';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { GracefulShutdownService } from './shutdown.service';

describe('HealthService', () => {
  it('reports ready when DB, migrations, recovery, and shutdown are healthy', async () => {
    const { service, metrics } = makeHealthService({
      queueRows: [{ status: 'DEAD', count: '2' }],
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: true,
      status: 'ready',
      checks: {
        database: { ok: true },
        migrations: { ok: true, detail: { pending: false } },
        recovery: { ok: true },
        shutdown: { ok: true },
      },
      recoveryQueue: {
        RECEIVED: 0,
        PROCESSING: 0,
        FAILED: 0,
        DEAD: 2,
      },
    });
    expect(metrics.renderPrometheus()).toContain(
      'kasicash_recovery_queue_depth{status="DEAD"} 2',
    );
  });

  it('reports not ready when the database cannot be reached', async () => {
    const { service } = makeHealthService({
      query: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      status: 'not_ready',
      checks: {
        database: {
          ok: false,
          detail: { code: 'DATABASE_UNAVAILABLE' },
        },
      },
    });
  });

  it('reports not ready when migrations are pending', async () => {
    const { service } = makeHealthService({
      showMigrations: jest.fn().mockResolvedValue(true),
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      status: 'not_ready',
      checks: {
        migrations: { ok: false, detail: { pending: true } },
      },
    });
  });

  it('reports draining liveness and not-ready shutdown state', async () => {
    const shutdown = new GracefulShutdownService(new MetricsService());
    shutdown.beginShutdown();
    const { service } = makeHealthService({ shutdown });

    expect(service.liveness()).toMatchObject({
      ok: true,
      status: 'draining',
    });
    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      checks: { shutdown: { ok: false } },
    });
  });

  it('reports not ready when the recovery worker is disabled', async () => {
    const { service } = makeHealthService({
      recoveryStatus: { enabled: false },
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      checks: { recovery: { ok: false } },
    });
  });

  it('reports not ready when the recovery worker heartbeat is stale', async () => {
    const { service } = makeHealthService({
      recoveryStatus: { fresh: false },
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      checks: { recovery: { ok: false } },
    });
  });

  it('reports not ready when migration state cannot be inspected', async () => {
    const { service } = makeHealthService({
      showMigrations: jest
        .fn()
        .mockRejectedValue(new Error('private db error')),
    });

    await expect(service.readiness()).resolves.toMatchObject({
      ok: false,
      checks: {
        migrations: {
          ok: false,
          detail: { code: 'MIGRATION_STATE_UNAVAILABLE' },
        },
      },
    });
  });

  it('reports not ready without leaking details when queue inspection fails', async () => {
    const { service } = makeHealthService({
      queueError: new Error('password=secret payload=R999.99'),
    });

    const result = await service.readiness();
    expect(result).toMatchObject({
      ok: false,
      checks: {
        recoveryQueue: {
          ok: false,
          detail: { code: 'RECOVERY_QUEUE_UNAVAILABLE' },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('999.99');
  });
});

function makeHealthService(
  overrides: {
    query?: jest.Mock;
    showMigrations?: jest.Mock;
    queueRows?: Array<{ status: string; count: string }>;
    queueError?: Error;
    recoveryStatus?: { enabled?: boolean; fresh?: boolean };
    shutdown?: GracefulShutdownService;
  } = {},
) {
  const query = overrides.query ?? jest.fn().mockResolvedValue([{ ok: 1 }]);
  const showMigrations =
    overrides.showMigrations ?? jest.fn().mockResolvedValue(false);
  const queueRows = overrides.queueRows ?? [];
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: overrides.queueError
      ? jest.fn().mockRejectedValue(overrides.queueError)
      : jest.fn().mockResolvedValue(queueRows),
  };
  const dataSource = {
    query,
    showMigrations,
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    },
  } as unknown as DataSource;
  const recovery = {
    getStatus: jest.fn().mockReturnValue({
      enabled: true,
      running: false,
      lastStartedAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastRecovered: 0,
      expectedIntervalMs: 30_000,
      fresh: true,
      ...overrides.recoveryStatus,
    }),
  };
  const metrics = new MetricsService();
  const shutdown =
    overrides.shutdown ?? new GracefulShutdownService(new MetricsService());
  return {
    service: new HealthService(
      dataSource,
      recovery as never,
      shutdown,
      metrics,
    ),
    metrics,
    queryBuilder,
  };
}
