import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { AnomalyService } from '../src/anomaly/anomaly.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { Business } from '../src/ledger/entities/business.entity';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { TransactionProposal } from '../src/parsing/entities/transaction-proposal.entity';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';

describe('Anomaly Integration (read-only detection and idempotent alerts)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ledger: LedgerService;
  let anomaly: AnomalyService;
  let businessA: Business;
  let businessB: Business;
  let businessC: Business;
  let cashA: Account;
  let salesA: Account;
  let expensesA: Account;
  let cashB: Account;
  let salesB: Account;
  let expensesB: Account;
  let cashC: Account;
  let salesC: Account;
  let asOfLocalDate: string;
  const wa: { sendText: jest.Mock<Promise<void>, [string, string]> } = {
    sendText: jest
      .fn<Promise<void>, [string, string]>()
      .mockResolvedValue(undefined),
  };

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
    anomaly = new AnomalyService(
      dataSource,
      new AnalyticsService(dataSource),
      wa,
    );
    asOfLocalDate = todayInJohannesburg();

    businessA = await createBusiness('Anomaly Trader A', '27830000001');
    businessB = await createBusiness('Anomaly Trader B', '27830000002');
    businessC = await createBusiness('Quiet Gap Trader', '27830000003');

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
    expensesB = await createAccount(
      'Stock B',
      '500.10',
      AccountType.EXPENSE,
      businessB.id,
    );
    cashC = await createAccount(
      'Cash C',
      '100',
      AccountType.ASSET,
      businessC.id,
    );
    salesC = await createAccount(
      'Sales C',
      '400',
      AccountType.REVENUE,
      businessC.id,
    );

    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      await postSale(
        businessA.id,
        cashA.id,
        salesA.id,
        `a-baseline-sale-${daysAgo}`,
        '100000',
        occurredAt(daysAgo),
      );
    }
    for (let daysAgo = 20; daysAgo >= 11; daysAgo--) {
      await postExpense(
        businessA.id,
        cashA.id,
        expensesA.id,
        `a-baseline-expense-${daysAgo}`,
        '10000',
        occurredAt(daysAgo),
      );
    }

    await postSale(
      businessA.id,
      cashA.id,
      salesA.id,
      'a-target-spike-sale',
      '250000',
      occurredAt(0),
    );
    await postExpense(
      businessA.id,
      cashA.id,
      expensesA.id,
      'a-target-large-expense',
      '60000',
      occurredAt(0, '12:00:00'),
    );
    const reversedExpense = await postExpense(
      businessA.id,
      cashA.id,
      expensesA.id,
      'a-target-reversed-large-expense',
      '70000',
      occurredAt(0, '13:00:00'),
    );
    await ledger.reverseTransaction(
      businessA.id,
      reversedExpense.id,
      'a-target-reversed-large-expense-reversal',
      'Supplier corrected duplicate',
    );

    await postSale(
      businessB.id,
      cashB.id,
      salesB.id,
      'b-other-tenant-huge-sale',
      '999999',
      occurredAt(0),
    );
    await postExpense(
      businessB.id,
      cashB.id,
      expensesB.id,
      'b-other-tenant-huge-expense',
      '999999',
      occurredAt(0),
    );
    await dataSource.manager.save(
      dataSource.manager.create(TransactionProposal, {
        businessId: businessA.id,
        sourceWaMessageId: 'pending-anomaly-noise',
        sourcePayloadHash: 'a'.repeat(64),
        kind: 'EXPENSE',
        amountMinor: '999999',
        currency: 'ZAR',
        description: 'unconfirmed huge expense',
        waTimestamp: occurredAt(0),
        receivedAt: occurredAt(0),
        status: 'PENDING',
      }),
    );

    for (let daysAgo = 30; daysAgo >= 21; daysAgo--) {
      await postSale(
        businessC.id,
        cashC.id,
        salesC.id,
        `c-active-sale-${daysAgo}`,
        '100000',
        occurredAt(daysAgo),
      );
    }
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('detects ledger-traceable large expense and sales spike with reversal netting', async () => {
    const anomalies = await anomaly.detectAnomalies({
      businessId: businessA.id,
      timezone: 'Africa/Johannesburg',
      asOfLocalDate,
      currency: 'ZAR',
    });

    expect(anomalies.map((item) => item.type).sort()).toEqual([
      'LARGE_EXPENSE',
      'SALES_SPIKE',
    ]);
    const largeExpense = anomalies.find(
      (item) => item.type === 'LARGE_EXPENSE',
    );
    const salesSpike = anomalies.find((item) => item.type === 'SALES_SPIKE');

    expect(largeExpense).toBeDefined();
    expect(salesSpike).toBeDefined();
    if (!largeExpense || !salesSpike) {
      throw new Error('expected large expense and sales spike anomalies');
    }
    expect(largeExpense.figures[0].label).toBe('Expense');
    expect(largeExpense.figures[0].value.amountMinor).toBe('60000');
    expect(largeExpense.figures[1].label).toBe('Baseline average');
    expect(largeExpense.figures[1].value.amountMinor).toBe('10000');
    expect(largeExpense.metadata.description).toBe('a-target-large-expense');
    expect(salesSpike.figures[0].label).toBe('Target sales');
    expect(salesSpike.figures[0].value.amountMinor).toBe('250000');
    expect(salesSpike.figures[1].label).toBe('Baseline average');
    expect(salesSpike.figures[1].value.amountMinor).toBe('100000');
  });

  it('does not leak other-tenant anomalies or pending proposals', async () => {
    const anomalies = await anomaly.detectAnomalies({
      businessId: businessB.id,
      timezone: 'Africa/Johannesburg',
      asOfLocalDate,
      currency: 'ZAR',
    });

    expect(anomalies).toEqual([]);
  });

  it('returns the same UTC candidate instant under a non-UTC database session timezone', async () => {
    const nonUtc = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      synchronize: false,
      extra: { options: '-c timezone=America/New_York' },
    });
    await nonUtc.initialize();
    try {
      const service = new AnomalyService(
        nonUtc,
        new AnalyticsService(nonUtc),
        wa,
      );
      const anomalies = await service.detectAnomalies({
        businessId: businessA.id,
        timezone: 'Africa/Johannesburg',
        asOfLocalDate,
        currency: 'ZAR',
      });
      const largeExpense = anomalies.find(
        (item) => item.type === 'LARGE_EXPENSE',
      );
      expect(largeExpense?.metadata.occurredAt).toBe(
        occurredAt(0, '12:00:00').toISOString(),
      );
    } finally {
      await nonUtc.destroy();
    }
  });

  it('detects an unusual activity gap for a normally active trader', async () => {
    const anomalies = await anomaly.detectAnomalies({
      businessId: businessC.id,
      timezone: 'Africa/Johannesburg',
      asOfLocalDate,
      currency: 'ZAR',
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe('ACTIVITY_GAP');
    expect(anomalies[0].period).toEqual({
      fromLocalDate: addLocalDays(asOfLocalDate, -2),
      toLocalDate: asOfLocalDate,
    });
    expect(anomalies[0].metadata.baselineActiveSalesDays).toBe('10');
  });

  it('dispatches each anomaly once via WhatsApp and records idempotency metadata', async () => {
    wa.sendText.mockClear();

    const first = await anomaly.dispatchAlerts({
      businessId: businessA.id,
      timezone: 'Africa/Johannesburg',
      asOfLocalDate,
      currency: 'ZAR',
    });
    const second = await anomaly.dispatchAlerts({
      businessId: businessA.id,
      timezone: 'Africa/Johannesburg',
      asOfLocalDate,
      currency: 'ZAR',
    });

    expect(first.sent).toBe(2);
    expect(second.skipped).toBe(2);
    expect(wa.sendText).toHaveBeenCalledTimes(2);
    const sendCalls = wa.sendText.mock.calls;
    expect(sendCalls.every((call) => call[0] === '27830000001')).toBe(true);
    expect(sendCalls.map((call) => call[1]).join('\n')).toContain('ZAR 600.00');

    const rows = await queryRows<{ type: string; status: string }>(
      dataSource,
      `SELECT anomaly_type AS "type", status FROM anomaly_alerts WHERE business_id = $1 ORDER BY anomaly_type`,
      [businessA.id],
    );
    expect(rows).toEqual([
      { type: 'LARGE_EXPENSE', status: 'SENT' },
      { type: 'SALES_SPIKE', status: 'SENT' },
    ]);
  });

  async function createBusiness(
    name: string,
    waPhone: string,
  ): Promise<Business> {
    return dataSource.manager.save(
      dataSource.manager.create(Business, { name, waPhone }),
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

  function postSale(
    businessId: string,
    cashAccountId: string,
    salesAccountId: string,
    idempotencyKey: string,
    amountMinor: string,
    date: Date,
  ) {
    return ledger.postTransaction({
      businessId,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
      occurredAt: date,
      receivedAt: date,
      entries: [
        { accountId: cashAccountId, amountMinor, type: 'DEBIT' },
        { accountId: salesAccountId, amountMinor, type: 'CREDIT' },
      ],
    });
  }

  function postExpense(
    businessId: string,
    cashAccountId: string,
    expenseAccountId: string,
    idempotencyKey: string,
    amountMinor: string,
    date: Date,
  ) {
    return ledger.postTransaction({
      businessId,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
      occurredAt: date,
      receivedAt: date,
      entries: [
        { accountId: expenseAccountId, amountMinor, type: 'DEBIT' },
        { accountId: cashAccountId, amountMinor, type: 'CREDIT' },
      ],
    });
  }
});

function occurredAt(daysAgo: number, time = '10:00:00'): Date {
  return johannesburgDateTimeToUtc(
    addLocalDays(todayInJohannesburg(), -daysAgo),
    time,
  );
}

function todayInJohannesburg(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;
}

function johannesburgDateTimeToUtc(localDate: string, time: string): Date {
  return new Date(`${localDate}T${time}+02:00`);
}

function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

async function queryRows<T>(
  dataSource: DataSource,
  sql: string,
  parameters: unknown[],
): Promise<T[]> {
  return await dataSource.query(sql, parameters);
}
