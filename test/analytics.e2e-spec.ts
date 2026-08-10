import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { Business } from '../src/ledger/entities/business.entity';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { TransactionProposal } from '../src/parsing/entities/transaction-proposal.entity';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';

describe('Analytics Integration (read-only migrated PostgreSQL schema)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ledger: LedgerService;
  let analytics: AnalyticsService;
  let businessA: Business;
  let businessB: Business;
  let businessC: Business;
  let cash: Account;
  let sales: Account;
  let stockExpense: Account;
  let businessBCash: Account;
  let businessBSales: Account;
  let timezoneCash: Account;
  let timezoneSales: Account;
  let currentMonth: LocalMonthRange;

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
    analytics = new AnalyticsService(dataSource);
    currentMonth = localMonthRange(new Date(), 'Africa/Johannesburg');

    businessA = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Analytics Trader A' }),
    );
    businessB = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Analytics Trader B' }),
    );
    businessC = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Analytics Timezone Co' }),
    );

    cash = await createAccount('Cash', '100', AccountType.ASSET, businessA.id);
    sales = await createAccount(
      'Sales',
      '400',
      AccountType.REVENUE,
      businessA.id,
    );
    stockExpense = await createAccount(
      'Stock',
      '500.10',
      AccountType.EXPENSE,
      businessA.id,
    );
    businessBCash = await createAccount(
      'Cash B',
      '100',
      AccountType.ASSET,
      businessB.id,
    );
    businessBSales = await createAccount(
      'Sales B',
      '400',
      AccountType.REVENUE,
      businessB.id,
    );
    timezoneCash = await createAccount(
      'Timezone Cash',
      '100',
      AccountType.ASSET,
      businessC.id,
    );
    timezoneSales = await createAccount(
      'Timezone Sales',
      '400',
      AccountType.REVENUE,
      businessC.id,
    );

    const baseOccurredAt = johannesburgDateTimeToUtc(
      currentMonth.from,
      '10:00:00',
    );
    const reversedSale = await postSale(
      businessA.id,
      cash.id,
      sales.id,
      'analytics-reversed-sale',
      '5000',
      baseOccurredAt,
    );
    await ledger.reverseTransaction(
      businessA.id,
      reversedSale.id,
      'analytics-reversal',
      'Customer refund',
    );
    await postSale(
      businessA.id,
      cash.id,
      sales.id,
      'analytics-kept-sale',
      '10000',
      plusSeconds(baseOccurredAt, 60),
    );
    await postExpense(
      'analytics-stock-expense',
      '3000',
      plusSeconds(baseOccurredAt, 120),
    );
    await postSale(
      businessB.id,
      businessBCash.id,
      businessBSales.id,
      'analytics-other-tenant-sale',
      '9999',
      plusSeconds(baseOccurredAt, 180),
    );
    await postSale(
      businessC.id,
      timezoneCash.id,
      timezoneSales.id,
      'analytics-timezone-sale',
      '1111',
      new Date('2026-02-28T22:30:00.000Z'),
    );
    await dataSource.manager.save(
      dataSource.manager.create(TransactionProposal, {
        businessId: businessA.id,
        sourceWaMessageId: 'pending-proposal-not-ledger',
        sourcePayloadHash: 'a'.repeat(64),
        kind: 'EXPENSE',
        amountMinor: '999999',
        currency: 'ZAR',
        description: 'unconfirmed proposal',
        waTimestamp: baseOccurredAt,
        receivedAt: baseOccurredAt,
        status: 'PENDING',
      }),
    );
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('returns cash balance over time with reversal netting and tenant isolation', async () => {
    const report = await analytics.getCashBalanceSeries({
      businessId: businessA.id,
      from: currentMonth.from,
      to: currentMonth.to,
      timezone: 'Africa/Johannesburg',
      granularity: 'month',
      currency: 'ZAR',
    });

    expect(report.points).toHaveLength(1);
    expect(report.points[0]).toMatchObject({
      label: currentMonth.label,
      cashDelta: { amountMinor: '7000' },
      cashBalance: { amountMinor: '7000' },
    });
  });

  it('returns income vs expenses per period from posted ledger entries only', async () => {
    const report = await analytics.getIncomeVsExpensesSeries({
      businessId: businessA.id,
      from: currentMonth.from,
      to: currentMonth.to,
      timezone: 'Africa/Johannesburg',
      granularity: 'month',
      currency: 'ZAR',
    });

    expect(report.points).toHaveLength(1);
    expect(report.points[0]).toMatchObject({
      revenue: { amountMinor: '10000' },
      expenses: { amountMinor: '3000' },
      netIncome: { amountMinor: '7000' },
    });
  });

  it('returns spend-by-account breakdown with pending proposals excluded', async () => {
    const report = await analytics.getSpendByAccountBreakdown({
      businessId: businessA.id,
      from: currentMonth.from,
      to: currentMonth.to,
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
    });

    expect(report.totalExpenses.amountMinor).toBe('3000');
    expect(report.accounts).toHaveLength(1);
    expect(report.accounts[0].accountId).toBe(stockExpense.id);
    expect(report.accounts[0].accountCode).toBe('500.10');
    expect(report.accounts[0].accountName).toBe('Stock');
    expect(report.accounts[0].expense.amountMinor).toBe('3000');
  });

  it('buckets by the requested business timezone before applying UTC ledger bounds', async () => {
    const report = await analytics.getCashBalanceSeries({
      businessId: businessC.id,
      from: '2026-03-01',
      to: '2026-03-01',
      timezone: 'Africa/Johannesburg',
      granularity: 'day',
      currency: 'ZAR',
    });

    expect(report.points).toHaveLength(1);
    expect(report.points[0]).toMatchObject({
      label: '2026-03-01',
      bucketStartUtc: '2026-02-28T22:00:00.000Z',
      bucketEndUtcExclusive: '2026-03-01T22:00:00.000Z',
      cashDelta: { amountMinor: '1111' },
      cashBalance: { amountMinor: '1111' },
    });
  });

  it('produces identical timezone buckets under a non-UTC database session', async () => {
    const nonUtcDataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      migrations: KASICASH_MIGRATIONS,
      synchronize: false,
      extra: { options: '-c timezone=Pacific/Auckland' },
    });
    await nonUtcDataSource.initialize();
    try {
      const [{ TimeZone: sessionTimezone }] =
        await nonUtcDataSource.query<Array<{ TimeZone: string }>>(
          `SHOW TIMEZONE`,
        );
      expect(sessionTimezone).toBe('Pacific/Auckland');

      const report = await new AnalyticsService(
        nonUtcDataSource,
      ).getCashBalanceSeries({
        businessId: businessC.id,
        from: '2026-03-01',
        to: '2026-03-01',
        timezone: 'Africa/Johannesburg',
        granularity: 'day',
        currency: 'ZAR',
      });

      expect(report.points[0]).toMatchObject({
        label: '2026-03-01',
        bucketStartUtc: '2026-02-28T22:00:00.000Z',
        bucketEndUtcExclusive: '2026-03-01T22:00:00.000Z',
        cashDelta: { amountMinor: '1111' },
      });
    } finally {
      await nonUtcDataSource.destroy();
    }
  });

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
        { accountId: cashAccountId, amountMinor, type: 'DEBIT' },
        { accountId: salesAccountId, amountMinor, type: 'CREDIT' },
      ],
    });
  }

  function postExpense(
    idempotencyKey: string,
    amountMinor: string,
    occurredAt: Date,
  ) {
    return ledger.postTransaction({
      businessId: businessA.id,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
      occurredAt,
      receivedAt: occurredAt,
      entries: [
        { accountId: stockExpense.id, amountMinor, type: 'DEBIT' },
        { accountId: cash.id, amountMinor, type: 'CREDIT' },
      ],
    });
  }
});

interface LocalMonthRange {
  from: string;
  to: string;
  label: string;
}

function plusSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function johannesburgDateTimeToUtc(localDate: string, time: string): Date {
  return new Date(`${localDate}T${time}+02:00`);
}

function localMonthRange(date: Date, timezone: string): LocalMonthRange {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthString = month.toString().padStart(2, '0');

  return {
    from: `${year}-${monthString}-01`,
    to: `${year}-${monthString}-${lastDay.toString().padStart(2, '0')}`,
    label: `${year}-${monthString}`,
  };
}
