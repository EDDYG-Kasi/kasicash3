import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { LedgerService } from '../src/ledger/ledger.service';
import { ReportsService } from '../src/reports/reports.service';
import { Business } from '../src/ledger/entities/business.entity';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { Transaction } from '../src/ledger/entities/transaction.entity';
import { Entry } from '../src/ledger/entities/entry.entity';
import { InboundMessage } from '../src/ingestion/entities/inbound-message.entity';
import { TransactionProposal } from '../src/parsing/entities/transaction-proposal.entity';
import { CreateLedgerCore1699999999000 } from '../src/migrations/1699999999000-CreateLedgerCore';
import { ImmutabilityTriggers1700000000000 } from '../src/migrations/1700000000000-ImmutabilityTriggers';
import { TenantConsistencyAndPolicies1700000001000 } from '../src/migrations/1700000001000-TenantConsistencyAndPolicies';
import { PostingLifecycle1700000002000 } from '../src/migrations/1700000002000-PostingLifecycle';
import { LedgerHardening1700000003000 } from '../src/migrations/1700000003000-LedgerHardening';
import { InboundMessages1700000004000 } from '../src/migrations/1700000004000-InboundMessages';
import { InboundRetryColumns1700000005000 } from '../src/migrations/1700000005000-InboundRetryColumns';
import { ReportReadIndexes1700000006000 } from '../src/migrations/1700000006000-ReportReadIndexes';
import { TransactionProposals1700000007000 } from '../src/migrations/1700000007000-TransactionProposals';

describe('Reports Integration (read-only migrated PostgreSQL schema)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ledger: LedgerService;
  let reports: ReportsService;
  let businessA: Business;
  let businessB: Business;
  let cash: Account;
  let sales: Account;
  let expenses: Account;
  let businessBCash: Account;
  let businessBSales: Account;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [
        Business,
        Account,
        Transaction,
        Entry,
        InboundMessage,
        TransactionProposal,
      ],
      migrations: [
        CreateLedgerCore1699999999000,
        ImmutabilityTriggers1700000000000,
        TenantConsistencyAndPolicies1700000001000,
        PostingLifecycle1700000002000,
        LedgerHardening1700000003000,
        InboundMessages1700000004000,
        InboundRetryColumns1700000005000,
        ReportReadIndexes1700000006000,
        TransactionProposals1700000007000,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    ledger = new LedgerService(dataSource);
    reports = new ReportsService(dataSource);

    businessA = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Reports Trader A' }),
    );
    businessB = await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Reports Trader B' }),
    );

    cash = await createAccount('Cash', '100', AccountType.ASSET, businessA.id);
    sales = await createAccount(
      'Sales',
      '400',
      AccountType.REVENUE,
      businessA.id,
    );
    expenses = await createAccount(
      'Expenses',
      '500',
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

    const reversedSale = await postSale('rev-sale', '3000');
    await postSale('kept-sale', '10000');
    await postExpense('stock', '2500');
    await ledger.reverseTransaction(reversedSale.id, 'rev-sale-key', 'Refund');
    await ledger.postTransaction({
      businessId: businessB.id,
      description: 'Other tenant sale',
      currency: 'ZAR',
      idempotencyKey: 'other-tenant-sale',
      sourceType: 'API',
      sourcePayloadHash: 'other-tenant-hash',
      occurredAt: new Date('2026-07-06T09:00:00.000Z'),
      receivedAt: new Date('2026-07-06T09:00:00.000Z'),
      entries: [
        { accountId: businessBCash.id, amountMinor: '9999', type: 'DEBIT' },
        { accountId: businessBSales.id, amountMinor: '9999', type: 'CREDIT' },
      ],
    });
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('reports current balances with reversal netting and tenant isolation', async () => {
    const report = await reports.getCashPosition({
      businessId: businessA.id,
      currency: 'ZAR',
    });

    expect(report.netCash.amountMinor).toBe('7500');
    expect(
      report.accounts.find((a) => a.accountId === cash.id)?.balance,
    ).toMatchObject({
      amountMinor: '7500',
      formatted: 'ZAR 75.00',
    });
    expect(
      report.accounts.find((a) => a.accountId === sales.id)?.balance
        .amountMinor,
    ).toBe('10000');
    expect(
      report.accounts.find((a) => a.accountId === expenses.id)?.balance
        .amountMinor,
    ).toBe('2500');
  });

  it('reports income statement from 400/500 account families', async () => {
    const report = await reports.getIncomeStatement({
      businessId: businessA.id,
      from: '2026-01-01',
      to: '2099-12-31',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
    });

    expect(report.revenue.amountMinor).toBe('10000');
    expect(report.expenses.amountMinor).toBe('2500');
    expect(report.netIncome.amountMinor).toBe('7500');
  });

  it('reports account statement with oldest-first running balance', async () => {
    const report = await reports.getAccountStatement({
      businessId: businessA.id,
      accountId: cash.id,
      from: '2026-01-01',
      to: '2099-12-31',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
      limit: 20,
      offset: 0,
    });

    expect(report.openingBalance.amountMinor).toBe('0');
    expect(report.total).toBe(4);
    expect(report.lines.map((line) => line.delta.amountMinor)).toEqual([
      '3000',
      '10000',
      '-2500',
      '-3000',
    ]);
    expect(report.lines.at(-1)?.runningBalance.amountMinor).toBe('7500');
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

  function postSale(idempotencyKey: string, amountMinor: string) {
    return ledger.postTransaction({
      businessId: businessA.id,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: `${idempotencyKey}-hash`,
      occurredAt: new Date(
        `2026-07-06T0${idempotencyKey === 'rev-sale' ? 8 : 9}:00:00.000Z`,
      ),
      receivedAt: new Date('2026-07-06T09:00:00.000Z'),
      entries: [
        { accountId: cash.id, amountMinor, type: 'DEBIT' },
        { accountId: sales.id, amountMinor, type: 'CREDIT' },
      ],
    });
  }

  function postExpense(idempotencyKey: string, amountMinor: string) {
    return ledger.postTransaction({
      businessId: businessA.id,
      description: idempotencyKey,
      currency: 'ZAR',
      idempotencyKey,
      sourceType: 'API',
      sourcePayloadHash: `${idempotencyKey}-hash`,
      occurredAt: new Date('2026-07-06T10:00:00.000Z'),
      receivedAt: new Date('2026-07-06T10:00:00.000Z'),
      entries: [
        { accountId: expenses.id, amountMinor, type: 'DEBIT' },
        { accountId: cash.id, amountMinor, type: 'CREDIT' },
      ],
    });
  }
});
