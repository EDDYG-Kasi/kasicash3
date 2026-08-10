import type { INestApplication } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthGuard, AuthenticatedRequest } from '../src/auth/auth.guard';
import { InboundMessage } from '../src/ingestion/entities/inbound-message.entity';
import { RecoveryService } from '../src/ingestion/recovery.service';
import { Business } from '../src/ledger/entities/business.entity';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';
import { ObservabilityController } from '../src/observability/observability.controller';
import { HealthService } from '../src/observability/health.service';
import { MetricsService } from '../src/observability/metrics.service';
import { GracefulShutdownService } from '../src/observability/shutdown.service';

describe('Observability Integration (real Postgres)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let app: INestApplication;
  let businessA: Business;
  let businessB: Business;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      migrations: KASICASH_MIGRATIONS,
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    businessA = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Ops Trader A' }),
    );
    businessB = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Ops Trader B' }),
    );
    await insertDeadLetter(businessA.id, 'ops-a-dead', 'PROCESSING_FAILED');
    await insertDeadLetter(businessB.id, 'ops-b-dead', 'PROCESSING_FAILED');

    const testingModule = await Test.createTestingModule({
      controllers: [ObservabilityController],
      providers: [
        HealthService,
        MetricsService,
        GracefulShutdownService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: RecoveryService,
          useValue: {
            getStatus: () => ({
              enabled: true,
              running: false,
              lastStartedAt: null,
              lastSuccessAt: null,
              lastErrorAt: null,
              lastRecovered: 0,
              expectedIntervalMs: 30_000,
              fresh: true,
            }),
          },
        },
        {
          provide: AuthGuard,
          useValue: {
            canActivate: (context: ExecutionContext) => {
              const request = context
                .switchToHttp()
                .getRequest<AuthenticatedRequest>();
              request.authPrincipal = {
                principalId: 'principal-a',
                businessId: businessA.id,
                email: 'ops-a@example.com',
                currency: 'ZAR',
                timezone: 'Africa/Johannesburg',
              };
              return true;
            },
          },
        },
      ],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('reports live health and ready state against the migrated database', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ ok: true, status: 'live' });
      });

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          ok: true,
          status: 'ready',
          checks: {
            database: { ok: true },
            migrations: { ok: true, detail: { pending: false } },
            recovery: { ok: true },
          },
          recoveryQueue: {
            DEAD: 2,
          },
        });
      });
  });

  it('surfaces dead letters only for the authenticated business without payload content', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/ops/dead-letter')
      .expect(200);
    const body = response.body as unknown as {
      businessId: string;
      count: number;
      items: Array<{
        id: string;
        waMessageId: string;
        status: string;
        attempts: number;
        errorCode: string | null;
      }>;
    };

    expect(body.businessId).toBe(businessA.id);
    expect(body.count).toBe(1);
    expect(typeof body.items[0]?.id).toBe('string');
    expect(body.items).toEqual([
      expect.objectContaining({
        waMessageId: 'ops-a-dead',
        status: 'DEAD',
        attempts: 5,
        errorCode: 'PROCESSING_FAILED',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('ops-b-dead');
    expect(JSON.stringify(body)).not.toContain('spent R99 private stock');
  });

  async function insertDeadLetter(
    businessId: string,
    messageId: string,
    errorCode: string,
  ) {
    return dataSource.manager.save(
      dataSource.manager.create(InboundMessage, {
        businessId,
        waMessageId: messageId,
        waFrom: '27830000000',
        payload: { text: 'spent R99 private stock' },
        payloadHash: 'a'.repeat(64),
        messageType: 'text',
        textBody: 'spent R99 private stock',
        waTimestamp: new Date('2026-07-01T10:00:00.000Z'),
        status: 'DEAD',
        attempts: 5,
        error: null,
        errorCode,
      }),
    );
  }
});
