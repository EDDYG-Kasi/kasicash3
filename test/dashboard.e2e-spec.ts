import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { AnomalyService } from '../src/anomaly/anomaly.service';
import { AnomalyAlert } from '../src/anomaly/entities/anomaly-alert.entity';
import { AuthController } from '../src/auth/auth.controller';
import { AuthGuard } from '../src/auth/auth.guard';
import { AuthService } from '../src/auth/auth.service';
import { AuthPrincipal } from '../src/auth/entities/auth-principal.entity';
import { hashPassword } from '../src/auth/password-hasher';
import { SecurityRateLimiterService } from '../src/auth/rate-limiter.service';
import { WebhookSecurityService } from '../src/auth/webhook-security.service';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import type { DashboardOverviewDto } from '../src/dashboard/dashboard.dto';
import { DashboardTenantGuard } from '../src/dashboard/dashboard-tenant.guard';
import { DashboardTenantContextService } from '../src/dashboard/dashboard-tenant-context.service';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { Business } from '../src/ledger/entities/business.entity';
import { LedgerService } from '../src/ledger/ledger.service';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';
import { TransactionProposal } from '../src/parsing/entities/transaction-proposal.entity';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';

describe('Dashboard Integration (read-only endpoint over existing services)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ledger: LedgerService;
  let app: INestApplication;
  let businessA: Business;
  let businessB: Business;
  let cashA: Account;
  let salesA: Account;
  let expensesA: Account;
  let cashB: Account;
  let salesB: Account;
  let authTokenA: string;
  let authTokenB: string;
  const authPassword = 'correct horse battery';

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

    ledger = new LedgerService(dataSource);
    businessA = await createBusiness('Dashboard Trader A');
    businessB = await createBusiness('Dashboard Trader B');
    cashA = await createAccount(
      'Cash A',
      '100',
      AccountType.ASSET,
      businessA.id,
    );
    salesA = await createAccount(
      'Sales A',
      '400',
      AccountType.REVENUE,
      businessA.id,
    );
    expensesA = await createAccount(
      'Stock A',
      '500.10',
      AccountType.EXPENSE,
      businessA.id,
    );
    cashB = await createAccount(
      'Cash B',
      '100',
      AccountType.ASSET,
      businessB.id,
    );
    salesB = await createAccount(
      'Sales B',
      '400',
      AccountType.REVENUE,
      businessB.id,
    );

    const reversedSale = await postSale(
      businessA.id,
      cashA.id,
      salesA.id,
      'dashboard-reversed-sale',
      '3000',
      new Date('2026-07-10T08:00:00.000Z'),
    );
    await postSale(
      businessA.id,
      cashA.id,
      salesA.id,
      'dashboard-kept-sale',
      '10000',
      new Date('2026-07-11T08:00:00.000Z'),
    );
    await postExpense(
      businessA.id,
      cashA.id,
      expensesA.id,
      'dashboard-stock-expense',
      '2500',
      new Date('2026-07-12T08:00:00.000Z'),
    );
    await ledger.reverseTransaction(
      businessA.id,
      reversedSale.id,
      'dashboard-reversal',
      'Customer refund',
    );
    await postSale(
      businessB.id,
      cashB.id,
      salesB.id,
      'dashboard-other-tenant-sale',
      '999999',
      new Date('2026-07-13T08:00:00.000Z'),
    );
    await dataSource.manager.save(
      dataSource.manager.create(TransactionProposal, {
        businessId: businessA.id,
        sourceWaMessageId: 'dashboard-pending-proposal',
        sourcePayloadHash: 'a'.repeat(64),
        kind: 'EXPENSE',
        amountMinor: '999999',
        currency: 'ZAR',
        description: 'pending proposal should not affect dashboard',
        waTimestamp: new Date('2026-07-14T08:00:00.000Z'),
        receivedAt: new Date('2026-07-14T08:00:00.000Z'),
        status: 'PENDING',
        confirmedByWaMessageId: null,
        transactionId: null,
      }),
    );
    await dataSource.manager.save(
      dataSource.manager.create(AnomalyAlert, {
        businessId: businessA.id,
        anomalyKey: 'anomaly:v1:dashboard:test',
        anomalyType: 'SALES_SPIKE',
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg',
        periodStartLocal: '2026-07-31',
        periodEndLocal: '2026-07-31',
        payload: { source: 'integration-test' },
        status: 'SENT',
        attempts: 1,
        lastError: null,
        sentAt: new Date('2026-07-31T08:00:00.000Z'),
      }),
    );
    await dataSource.manager.save(
      dataSource.manager.create(AnomalyAlert, {
        businessId: businessB.id,
        anomalyKey: 'anomaly:v1:dashboard:other-tenant',
        anomalyType: 'LARGE_EXPENSE',
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg',
        periodStartLocal: '2026-07-31',
        periodEndLocal: '2026-07-31',
        payload: { source: 'integration-test' },
        status: 'SENT',
        attempts: 1,
        lastError: null,
        sentAt: new Date('2026-07-31T08:00:00.000Z'),
      }),
    );
    await createPrincipal('owner-a@example.com', businessA.id, authPassword);
    await createPrincipal('owner-b@example.com', businessB.id, authPassword);

    const testingModule = await Test.createTestingModule({
      controllers: [AuthController, DashboardController, ReportsController],
      providers: [
        AuthGuard,
        AuthService,
        SecurityRateLimiterService,
        DashboardService,
        DashboardTenantGuard,
        DashboardTenantContextService,
        { provide: ReportsService, useValue: new ReportsService(dataSource) },
        {
          provide: AnalyticsService,
          useValue: new AnalyticsService(dataSource),
        },
        {
          provide: AnomalyService,
          useValue: new AnomalyService(
            dataSource,
            new AnalyticsService(dataSource),
            {
              sendText: jest.fn().mockResolvedValue(undefined),
            },
          ),
        },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: testConfig(),
        },
      ],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    authTokenA = await login('owner-a@example.com', authPassword);
    authTokenB = await login('owner-b@example.com', authPassword);
  }, 180000);

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('rejects unauthenticated dashboard and report reads', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/dashboard/api/overview')
      .expect(401);
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/reports/balances')
      .expect(401);
  });

  it('returns report and analytics figures for the authenticated tenant only', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/dashboard/api/overview')
      .set('Authorization', `Bearer ${authTokenA}`)
      .query({
        businessId: businessB.id,
        from: '2026-07-01',
        to: '2026-07-31',
        accountId: cashA.id,
        asOfLocalDate: '2026-07-31',
      })
      .expect(200);
    const body = response.body as unknown as DashboardOverviewDto;

    expect(body.tenant).toMatchObject({
      businessId: businessA.id,
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg',
      authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL',
      productionReady: true,
    });
    expect(body.cashPosition.netCash.amountMinor).toBe('7500');
    expect(body.incomeStatement.revenue.amountMinor).toBe('10000');
    expect(body.incomeStatement.expenses.amountMinor).toBe('2500');
    expect(body.incomeStatement.netIncome.amountMinor).toBe('7500');
    expect(body.analytics.spendByAccount.totalExpenses.amountMinor).toBe(
      '2500',
    );
    expect(body.accountStatement?.lines).toHaveLength(4);
    expect(
      body.accountStatement?.lines.map((line) => line.delta.amountMinor),
    ).toEqual(['3000', '10000', '-2500', '-3000']);
    expect(body.kpis).toEqual({
      transactionCount: 4,
      transactionCountLabel: '100 money movements',
    });
    expect(body.analytics.chartScales.spendByAccount).toEqual([
      expect.objectContaining({
        label: '500.10 Stock A',
        valuePermille: 1000,
        valuePercent: '100.0',
      }),
    ]);
    expect(
      body.analytics.chartScales.incomeVsExpenses.every(
        (point) =>
          typeof point.valuePercent === 'string' &&
          typeof point.secondaryValuePercent === 'string',
      ),
    ).toBe(true);
    expect(body.anomalies.alertStatuses).toEqual([
      expect.objectContaining({
        anomalyKey: 'anomaly:v1:dashboard:test',
        anomalyType: 'SALES_SPIKE',
        status: 'SENT',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain(
      'anomaly:v1:dashboard:other-tenant',
    );
    expect(JSON.stringify(body)).not.toContain('999999');
  });

  it('enforces server-side tenant isolation on direct report routes', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/reports/balances')
      .set('Authorization', `Bearer ${authTokenA}`)
      .query({
        businessId: businessB.id,
        currency: 'USD',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      businessId: businessA.id,
      currency: 'ZAR',
      netCash: { amountMinor: '7500' },
    });
    expect(JSON.stringify(response.body)).not.toContain('999999');
  });

  it('rejects cross-tenant account IDs even when the caller has a valid token', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get(`/reports/accounts/${cashB.id}/statement`)
      .set('Authorization', `Bearer ${authTokenA}`)
      .query({
        from: '2026-07-01',
        to: '2026-07-31',
      })
      .expect(404);
  });

  it('binds another principal to only its own business data', async () => {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .get('/reports/balances')
      .set('Authorization', `Bearer ${authTokenB}`)
      .query({
        businessId: businessA.id,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      businessId: businessB.id,
      currency: 'ZAR',
      netCash: { amountMinor: '999999' },
    });
    expect(JSON.stringify(response.body)).not.toContain('7500');
  });

  it('shares rate-limit counters across independent service instances', async () => {
    const firstInstance = new SecurityRateLimiterService(dataSource);
    const secondInstance = new SecurityRateLimiterService(dataSource);
    const key = `integration-shared-rate-limit:${businessA.id}`;

    await expect(firstInstance.assertAllowed(key, 1, 60_000)).resolves.toBe(
      undefined,
    );
    await expect(secondInstance.assertAllowed(key, 1, 60_000)).rejects.toThrow(
      'Too many requests',
    );

    const [{ keyHash }] = await dataSource.query<Array<{ keyHash: string }>>(
      `SELECT key_hash AS "keyHash" FROM security_rate_limits ORDER BY window_started_at DESC LIMIT 1`,
    );
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(keyHash).not.toContain(businessA.id);
  });

  it('uses the PostgreSQL clock even when the application clock is skewed', async () => {
    const limiter = new SecurityRateLimiterService(dataSource);
    const key = `integration-clock-skew:${businessA.id}`;
    const dateNow = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2099-01-01T00:00:00.000Z').getTime());
    try {
      await expect(limiter.assertAllowed(key, 1, 60_000)).resolves.toBe(
        undefined,
      );
      await expect(limiter.assertAllowed(key, 1, 60_000)).rejects.toThrow(
        'Too many requests',
      );
      const [{ remainingMs }] = await dataSource.query<
        Array<{ remainingMs: string }>
      >(`
        SELECT (extract(epoch FROM (expires_at - now())) * 1000)::bigint::text AS "remainingMs"
        FROM security_rate_limits
        ORDER BY window_started_at DESC
        LIMIT 1;
      `);
      expect(BigInt(remainingMs)).toBeGreaterThan(0n);
      expect(BigInt(remainingMs)).toBeLessThanOrEqual(60_000n);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('refreshes an expired webhook replay record before accepting it again', async () => {
    const replay = new WebhookSecurityService(dataSource, testConfig());
    const rawBody = Buffer.from(`replay-refresh-${businessA.id}`);
    await replay.recordAccepted(rawBody, 'sha256=first');
    await dataSource.query(
      `UPDATE webhook_replay_events SET expires_at = now() - interval '1 second'`,
    );

    await replay.recordAccepted(rawBody, 'sha256=second');

    await expect(replay.wasAcceptedRecently(rawBody)).resolves.toBe(true);
    const [{ future }] = await dataSource.query<Array<{ future: boolean }>>(
      `SELECT expires_at > now() AS future FROM webhook_replay_events LIMIT 1`,
    );
    expect(future).toBe(true);
  });

  async function createBusiness(name: string): Promise<Business> {
    return dataSource.manager.save(
      dataSource.manager.create(Business, { name }),
    );
  }

  async function createAccount(
    name: string,
    code: string,
    type: AccountType,
    businessId: string,
  ): Promise<Account> {
    return dataSource.manager.save(
      dataSource.manager.create(Account, { name, code, type, businessId }),
    );
  }

  async function createPrincipal(
    email: string,
    businessId: string,
    password: string,
  ): Promise<AuthPrincipal> {
    return dataSource.manager.save(
      dataSource.manager.create(AuthPrincipal, {
        businessId,
        email,
        emailNormalized: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
        defaultCurrency: 'ZAR',
        timezone: 'Africa/Johannesburg',
      }),
    );
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return (response.body as { token: string }).token;
  }

  function postSale(
    businessId: string,
    cashId: string,
    salesId: string,
    idempotencyKey: string,
    amountMinor: string,
    occurredAt: Date,
  ) {
    return ledger.postTransaction({
      businessId,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
      occurredAt,
      receivedAt: occurredAt,
      entries: [
        { accountId: cashId, amountMinor, type: 'DEBIT' },
        { accountId: salesId, amountMinor, type: 'CREDIT' },
      ],
    });
  }

  function postExpense(
    businessId: string,
    cashId: string,
    expenseId: string,
    idempotencyKey: string,
    amountMinor: string,
    occurredAt: Date,
  ) {
    return ledger.postTransaction({
      businessId,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
      occurredAt,
      receivedAt: occurredAt,
      entries: [
        { accountId: expenseId, amountMinor, type: 'DEBIT' },
        { accountId: cashId, amountMinor, type: 'CREDIT' },
      ],
    });
  }
});

function testConfig(): ConfigService {
  return {
    get: (key: string) =>
      ({
        KASICASH_AUTH_SESSION_TTL_MINUTES: '480',
        KASICASH_AUTH_COOKIE_SECURE: 'false',
      })[key],
  } as unknown as ConfigService;
}
