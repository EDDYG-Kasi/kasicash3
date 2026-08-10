/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { LedgerService } from '../src/ledger/ledger.service';
import { Business } from '../src/ledger/entities/business.entity';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { Transaction } from '../src/ledger/entities/transaction.entity';
import { Entry } from '../src/ledger/entities/entry.entity';
import { InboundMessage } from '../src/ingestion/entities/inbound-message.entity';
import { WebhookDelivery } from '../src/ingestion/entities/webhook-delivery.entity';
import { TransactionProposal } from '../src/parsing/entities/transaction-proposal.entity';
import { RecoveryService } from '../src/ingestion/recovery.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { OnboardingService } from '../src/ingestion/onboarding.service';
import { ParsingService } from '../src/parsing/parsing.service';
import { ConversationalQueryService } from '../src/conversational-query/conversational-query.service';
import type { WhatsAppClient } from '../src/ingestion/whatsapp.client';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';

describe('Ledger Integration (migrated PostgreSQL schema)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let ledgerService: LedgerService;

  let businessA: Business;
  let businessB: Business;
  let a1: Account; // business A - asset
  let a2: Account; // business A - revenue
  let bAccount: Account; // business B - asset

  const baseDto = (
    over: Partial<Parameters<LedgerService['postTransaction']>[0]>,
  ) => ({
    businessId: businessA.id,
    description: 'Test Tx',
    currency: 'ZAR',
    idempotencyKey: 'k-' + Math.random().toString(36).slice(2),
    sourceType: 'API',
    sourcePayloadHash: 'a'.repeat(64),
    occurredAt: new Date(),
    receivedAt: new Date(),
    entries: [
      { accountId: a1.id, amountMinor: '1000', type: 'DEBIT' as const },
      { accountId: a2.id, amountMinor: '1000', type: 'CREDIT' as const },
    ],
    ...over,
  });

  beforeAll(async () => {
    try {
      container = await new PostgreSqlContainer('postgres:15-alpine').start();
    } catch (err) {
      console.error(
        'Failed to start Testcontainers. Ensure Docker is running.',
        err,
      );
      throw err;
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      migrations: KASICASH_MIGRATIONS,
      synchronize: false, // Prove the real migration path, not entity sync.
    });

    await dataSource.initialize();
    await dataSource.runMigrations();

    ledgerService = new LedgerService(dataSource);

    const m = dataSource.manager;
    businessA = await m.save(m.create(Business, { name: 'Business A' }));
    businessB = await m.save(m.create(Business, { name: 'Business B' }));
    a1 = await m.save(
      m.create(Account, {
        name: 'Cash',
        code: '100',
        type: AccountType.ASSET,
        businessId: businessA.id,
      }),
    );
    a2 = await m.save(
      m.create(Account, {
        name: 'Sales',
        code: '400',
        type: AccountType.REVENUE,
        businessId: businessA.id,
      }),
    );
    bAccount = await m.save(
      m.create(Account, {
        name: 'Cash B',
        code: '100',
        type: AccountType.ASSET,
        businessId: businessB.id,
      }),
    );
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('posts a balanced transaction (status POSTED) and blocks entry updates', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'imm-1' }),
    );
    expect(tx.status).toBe('POSTED');
    await expect(
      dataSource.manager.update(Entry, tx.entries[0].id, {
        amountMinor: '2000',
      }),
    ).rejects.toThrow('Entries cannot be updated or deleted');
  });

  it('posts balanced totals above signed bigint without aggregate overflow', async () => {
    const maximumEntry = '9223372036854775807';
    const tx = await ledgerService.postTransaction(
      baseDto({
        idempotencyKey: 'aggregate-above-int64',
        entries: [
          { accountId: a1.id, amountMinor: maximumEntry, type: 'DEBIT' },
          { accountId: a1.id, amountMinor: maximumEntry, type: 'DEBIT' },
          { accountId: a2.id, amountMinor: maximumEntry, type: 'CREDIT' },
          { accountId: a2.id, amountMinor: maximumEntry, type: 'CREDIT' },
        ],
      }),
    );

    expect(tx.status).toBe('POSTED');
    expect(tx.entries).toHaveLength(4);
  });

  it('blocks entry deletes', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'imm-2' }),
    );
    await expect(
      dataSource.manager.delete(Entry, tx.entries[0].id),
    ).rejects.toThrow('Entries cannot be updated or deleted');
  });

  it('freezes account code and type after the account is referenced', async () => {
    await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'account-classification-1' }),
    );

    await expect(
      dataSource.manager.update(Account, a2.id, { type: AccountType.EXPENSE }),
    ).rejects.toThrow('account business_id, code, and type are immutable');
    await expect(
      dataSource.manager.update(Account, a2.id, { code: '999' }),
    ).rejects.toThrow('account business_id, code, and type are immutable');

    const unchanged = await dataSource.manager.findOneByOrFail(Account, {
      id: a2.id,
    });
    expect(unchanged).toMatchObject({ code: '400', type: AccountType.REVENUE });
  });

  it('freezes account classification before its first entry exists', async () => {
    const fresh = await dataSource.manager.save(
      dataSource.manager.create(Account, {
        businessId: businessA.id,
        name: 'Future expense',
        code: '777',
        type: AccountType.EXPENSE,
      }),
    );

    await expect(
      dataSource.manager.update(Account, fresh.id, { code: '778' }),
    ).rejects.toThrow('account business_id, code, and type are immutable');
    await expect(
      dataSource.manager.update(Account, fresh.id, {
        type: AccountType.REVENUE,
      }),
    ).rejects.toThrow('account business_id, code, and type are immutable');
  });

  it('rejects reclassification from a second connection while the first entry is uncommitted', async () => {
    const fresh = await dataSource.manager.save(
      dataSource.manager.create(Account, {
        businessId: businessA.id,
        name: 'Concurrent expense',
        code: '779',
        type: AccountType.EXPENSE,
      }),
    );
    const first = dataSource.createQueryRunner();
    const second = dataSource.createQueryRunner();
    await first.connect();
    await second.connect();
    await first.startTransaction();
    try {
      const rows = (await first.query(
        `INSERT INTO transactions (
           business_id, description, currency, idempotency_key, source_type,
           source_payload_hash, status, occurred_at, received_at
         ) VALUES ($1, 'concurrent', 'ZAR', 'account-race', 'API', repeat('a',64), 'POSTING', now(), now())
         RETURNING id`,
        [businessA.id],
      )) as unknown as Array<{ id: string }>;
      await first.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id)
         VALUES ($1, '100', 'DEBIT', $2, $3), ($1, '100', 'CREDIT', $2, $4)`,
        [businessA.id, rows[0].id, fresh.id, a1.id],
      );

      await expect(
        second.query(`UPDATE accounts SET type = 'REVENUE' WHERE id = $1`, [
          fresh.id,
        ]),
      ).rejects.toThrow('account business_id, code, and type are immutable');
    } finally {
      await first.rollbackTransaction().catch(() => undefined);
      await first.release();
      await second.release();
    }
  });

  it('blocks appending entries to an already-posted transaction (entry-set immutability)', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'late-1' }),
    );
    await expect(
      dataSource.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id) VALUES ($1,$2,$3,$4,$5)`,
        [businessA.id, '100', 'DEBIT', tx.id, a1.id],
      ),
    ).rejects.toThrow(
      'entries may only be added while a transaction is POSTING',
    );
  });

  it('blocks economic-field updates and forged status changes', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'imm-3' }),
    );
    await expect(
      dataSource.manager.update(Transaction, tx.id, { description: 'Hacked' }),
    ).rejects.toThrow('Economic fields of transactions cannot be modified');

    // POSTED -> REVERSED with no actual reversal row must fail at commit.
    await expect(
      dataSource.manager.update(Transaction, tx.id, { status: 'REVERSED' }),
    ).rejects.toThrow('without a POSTED same-business reversal');

    // Any other status value is rejected (CHECK / invalid transition).
    await expect(
      dataSource.manager.update(Transaction, tx.id, { status: 'FROZEN' }),
    ).rejects.toThrow();
  });

  it('rejects an unbalanced transaction at commit (existing balance trigger)', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const tx = await qr.manager.save(
        qr.manager.create(Transaction, {
          businessId: businessA.id,
          description: 'Unbalanced',
          currency: 'ZAR',
          idempotencyKey: 'unbal-1',
          sourceType: 'API',
          sourcePayloadHash: 'a'.repeat(64),
          status: 'POSTING',
          occurredAt: new Date(),
          receivedAt: new Date(),
        }),
      );
      await qr.manager.save([
        qr.manager.create(Entry, {
          businessId: businessA.id,
          transactionId: tx.id,
          accountId: a1.id,
          amountMinor: '100',
          type: 'DEBIT',
        }),
        qr.manager.create(Entry, {
          businessId: businessA.id,
          transactionId: tx.id,
          accountId: a2.id,
          amountMinor: '50',
          type: 'CREDIT',
        }),
      ]);
      await qr.manager.update(Transaction, tx.id, { status: 'POSTED' });
      await expect(qr.commitTransaction()).rejects.toThrow(
        'Double-entry violation',
      );
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a transaction committed with zero entries (zero-entry guard)', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, occurred_at, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,now(),now())`,
        [businessA.id, 'Empty', 'ZAR', 'empty-1', 'API', 'a'.repeat(64)],
      );
      await expect(qr.commitTransaction()).rejects.toThrow(
        'committed with no entries',
      );
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a raw cross-business entry insert (tenant isolation composite FK)', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, status, occurred_at, received_at)
         VALUES ($1,'x','ZAR','xb-1','API',repeat('a',64),'POSTING',now(),now()) RETURNING id`,
        [businessA.id],
      );
      const txId = rows[0].id;
      // Business A transaction (POSTING), Business B account, tagged Business A -> composite FK must fail.
      await expect(
        qr.query(
          `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id) VALUES ($1,$2,$3,$4,$5)`,
          [businessA.id, '100', 'DEBIT', txId, bAccount.id],
        ),
      ).rejects.toThrow('FK_entries_account_business');
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects an external transaction with a NULL payload hash (DB check)', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, occurred_at, received_at)
         VALUES ($1,'x','ZAR','ext-nohash','API',now(),now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_external_payload_hash');
  });

  it('rejects unsupported currencies at the database boundary', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, occurred_at, received_at)
         VALUES ($1,'unsupported currency','EUR','unsupported-eur','API',repeat('a',64),now(),now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_supported_currency');
  });

  it('rejects a transaction inserted directly as REVERSED', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, status, occurred_at, received_at)
         VALUES ($1,'x','ZAR','rev-direct','API',repeat('a',64),'REVERSED',now(),now())`,
        [businessA.id],
      );
      await expect(qr.commitTransaction()).rejects.toThrow();
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a transaction left committed in POSTING state', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, status, occurred_at, received_at)
         VALUES ($1,'x','ZAR','stuck-posting','API',repeat('a',64),'POSTING',now(),now()) RETURNING id`,
        [businessA.id],
      );
      const txId = rows[0].id;
      await qr.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id) VALUES ($1,'100','DEBIT',$2,$3),($1,'100','CREDIT',$2,$4)`,
        [businessA.id, txId, a1.id, a2.id],
      );
      // Balanced and non-empty, but never flipped to POSTED -> must be rejected at commit.
      await expect(qr.commitTransaction()).rejects.toThrow(
        'may not be committed in POSTING state',
      );
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a reversal row that points at an original in another business (composite self-FK)', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'xrev-1' }),
    );
    // Try to create a Business B reversal pointing at a Business A original.
    await expect(
      dataSource.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, reversal_of_transaction_id, status, occurred_at, received_at)
         VALUES ($1,'bad','ZAR','xrev-bad','SYSTEM',$2,'POSTING',now(),now())`,
        [businessB.id, original.id],
      ),
    ).rejects.toThrow('FK_transactions_reversal_same_business');
  });

  it('rejects an external transaction with an empty-string payload hash (DB check)', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, occurred_at, received_at)
         VALUES ($1,'x','ZAR','ext-empty','API','   ',now(),now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_external_payload_hash');
  });

  it('enforces canonical source provenance at the database boundary', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO transactions (
           business_id, description, currency, idempotency_key, source_type,
           source_payload_hash, occurred_at, received_at
         ) VALUES ($1, 'bad type', 'ZAR', 'bad-source-type', 'EMAIL', repeat('a',64), now(), now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_source_type_v2');
    await expect(
      dataSource.query(
        `INSERT INTO transactions (
           business_id, description, currency, idempotency_key, source_type,
           source_payload_hash, occurred_at, received_at
         ) VALUES ($1, 'bad hash', 'ZAR', 'bad-source-hash', 'API', repeat('A',64), now(), now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_source_hash_v2');
    await expect(
      dataSource.query(
        `INSERT INTO transactions (
           business_id, description, currency, idempotency_key, source_type,
           source_payload_hash, occurred_at, received_at
         ) VALUES ($1, 'missing message', 'ZAR', 'bad-wa-source', 'WHATSAPP', repeat('a',64), now(), now())`,
        [businessA.id],
      ),
    ).rejects.toThrow('CHK_transactions_whatsapp_source_id_v2');
  });

  it('blocks deleting a posted transaction', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'del-1' }),
    );
    await expect(dataSource.manager.delete(Transaction, tx.id)).rejects.toThrow(
      'Transactions cannot be deleted',
    );
  });

  it('rejects a reversal whose entries do not mirror the original', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'mir-src' }),
    );
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const rows = await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, reversal_of_transaction_id, status, occurred_at, received_at)
         VALUES ($1,'forged','ZAR','mir-bad','SYSTEM',$2,'POSTING',now(),now()) RETURNING id`,
        [businessA.id, original.id],
      );
      const revId = rows[0].id;
      // Balanced but NOT inverted (copies the original's sides) -> passes balance, fails mirror.
      await qr.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id) VALUES ($1,'1000','DEBIT',$2,$3),($1,'1000','CREDIT',$2,$4)`,
        [businessA.id, revId, a1.id, a2.id],
      );
      await qr.query(`UPDATE transactions SET status='POSTED' WHERE id=$1`, [
        revId,
      ]);
      await expect(qr.commitTransaction()).rejects.toThrow(
        'does not mirror original',
      );
    } finally {
      await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a posted reversal while its original remains POSTED', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'orphan-reversal-source' }),
    );
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [{ id: reversalId }] = (await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, reversal_of_transaction_id, status, occurred_at, received_at)
         VALUES ($1,'orphan reversal','ZAR','orphan-reversal','SYSTEM',$2,'POSTING',now(),now()) RETURNING id`,
        [businessA.id, original.id],
      )) as Array<{ id: string }>;
      await qr.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id)
         VALUES ($1,'1000','CREDIT',$2,$3),($1,'1000','DEBIT',$2,$4)`,
        [businessA.id, reversalId, a1.id, a2.id],
      );
      await qr.query(`UPDATE transactions SET status='POSTED' WHERE id=$1`, [
        reversalId,
      ]);

      await expect(qr.commitTransaction()).rejects.toThrow(
        'must match a REVERSED same-business, same-currency original',
      );
    } finally {
      if (qr.isTransactionActive)
        await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a cross-currency reversal even when both rows otherwise balance', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'cross-currency-source' }),
    );
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [{ id: reversalId }] = (await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, reversal_of_transaction_id, status, occurred_at, received_at)
         VALUES ($1,'cross currency reversal','USD','cross-currency-reversal','SYSTEM',$2,'POSTING',now(),now()) RETURNING id`,
        [businessA.id, original.id],
      )) as Array<{ id: string }>;
      await qr.query(
        `INSERT INTO entries (business_id, amount_minor, type, transaction_id, account_id)
         VALUES ($1,'1000','CREDIT',$2,$3),($1,'1000','DEBIT',$2,$4)`,
        [businessA.id, reversalId, a1.id, a2.id],
      );
      await qr.query(`UPDATE transactions SET status='POSTED' WHERE id=$1`, [
        reversalId,
      ]);
      await qr.query(`UPDATE transactions SET status='REVERSED' WHERE id=$1`, [
        original.id,
      ]);

      await expect(qr.commitTransaction()).rejects.toThrow('same-currency');
    } finally {
      if (qr.isTransactionActive)
        await qr.rollbackTransaction().catch(() => {});
      await qr.release();
    }
  });

  it('rejects a raw reversal pointing at another reversal (reversal-of-reversal)', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rr-src' }),
    );
    const reversal = await ledgerService.reverseTransaction(
      businessA.id,
      original.id,
      'rr-key',
      'Refund',
    );
    await expect(
      dataSource.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, reversal_of_transaction_id, status, occurred_at, received_at)
         VALUES ($1,'bad','ZAR','rr-bad','SYSTEM',$2,'POSTING',now(),now())`,
        [businessA.id, reversal.id],
      ),
    ).rejects.toThrow('a reversal transaction cannot itself be reversed');
  });

  it('returns the existing transaction on duplicate idempotency key with matching payload hash', async () => {
    const dto = baseDto({
      idempotencyKey: 'idem-match',
      sourcePayloadHash: 'a'.repeat(64),
    });
    const first = await ledgerService.postTransaction(dto);
    const second = await ledgerService.postTransaction(dto);
    expect(second.id).toBe(first.id);
  });

  it('throws Conflict on duplicate idempotency key with a different payload hash', async () => {
    await ledgerService.postTransaction(
      baseDto({
        idempotencyKey: 'idem-diff',
        sourcePayloadHash: 'a'.repeat(64),
      }),
    );
    await expect(
      ledgerService.postTransaction(
        baseDto({
          idempotencyKey: 'idem-diff',
          sourcePayloadHash: 'b'.repeat(64),
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reverses a transaction with inverted entries and marks the original REVERSED', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-1' }),
    );
    const reversal = await ledgerService.reverseTransaction(
      businessA.id,
      original.id,
      'rev-key-1',
      'Refund',
    );

    expect(reversal.reversalOfTransactionId).toBe(original.id);
    expect(reversal.entries.find((e) => e.accountId === a1.id)?.type).toBe(
      'CREDIT',
    );
    expect(reversal.entries.find((e) => e.accountId === a2.id)?.type).toBe(
      'DEBIT',
    );

    const refreshed = await dataSource.manager.findOneOrFail(Transaction, {
      where: { id: original.id },
    });
    expect(refreshed.status).toBe('REVERSED');
  });

  it('cannot reverse another tenant transaction by supplying its id', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'tenant-reversal-source' }),
    );

    await expect(
      ledgerService.reverseTransaction(
        businessB.id,
        original.id,
        'tenant-reversal-attempt',
        'unauthorized',
      ),
    ).rejects.toThrow('Original transaction not found');

    const unchanged = await dataSource.manager.findOneByOrFail(Transaction, {
      id: original.id,
    });
    expect(unchanged.status).toBe('POSTED');
  });

  it('reversal idempotency only returns the existing reversal for the same original; conflicts otherwise', async () => {
    const original1 = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-2a' }),
    );
    const original2 = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-2b' }),
    );

    const r1 = await ledgerService.reverseTransaction(
      businessA.id,
      original1.id,
      'rev-key-2',
      'Refund',
    );
    const r1Again = await ledgerService.reverseTransaction(
      businessA.id,
      original1.id,
      'rev-key-2',
      'Refund',
    );
    expect(r1Again.id).toBe(r1.id);

    await expect(
      ledgerService.reverseTransaction(
        businessA.id,
        original2.id,
        'rev-key-2',
        'Refund',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Recovery worker (migrated schema)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

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
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  const insert = (over: Partial<InboundMessage>) =>
    dataSource.manager.save(
      dataSource.manager.create(InboundMessage, {
        waMessageId: 'wamid-' + Math.random().toString(36).slice(2),
        waFrom: '27830000000',
        payload: { t: 'x' },
        payloadHash: 'a'.repeat(64),
        messageType: 'text',
        waTimestamp: new Date(),
        ...over,
      }),
    );

  it('claims only stale RECEIVED and due FAILED rows, skipping fresh/future/DEAD', async () => {
    const now = Date.now();
    const staleReceived = await insert({
      status: 'RECEIVED',
      receivedAt: new Date(now - 5 * 60_000),
    });
    const freshReceived = await insert({
      status: 'RECEIVED',
      receivedAt: new Date(now),
    });
    const dueFailed = await insert({
      status: 'FAILED',
      attempts: 1,
      nextRetryAt: new Date(now - 60_000),
    });
    const futureFailed = await insert({
      status: 'FAILED',
      attempts: 1,
      nextRetryAt: new Date(now + 60 * 60_000),
    });
    const dead = await insert({ status: 'DEAD', attempts: 5 });
    const staleProcessing = await insert({
      status: 'PROCESSING',
      claimToken: '00000000-0000-4000-8000-000000000001',
      leaseExpiresAt: new Date(now - 60_000),
    });
    const freshProcessing = await insert({
      status: 'PROCESSING',
      claimToken: '00000000-0000-4000-8000-000000000002',
      leaseExpiresAt: new Date(now + 5 * 60_000),
    });

    const claimed: string[] = [];
    const fakeIngestion = {
      processMessage: (id: string) => {
        claimed.push(id);
        return Promise.resolve(true);
      },
    } as unknown as IngestionService;

    const recovery = new RecoveryService(dataSource, fakeIngestion);
    const result = await recovery.runRecoveryCycle();

    expect(claimed).toContain(staleReceived.id);
    expect(claimed).toContain(dueFailed.id);
    expect(claimed).toContain(staleProcessing.id); // expired lease reclaimed
    expect(claimed).not.toContain(freshReceived.id);
    expect(claimed).not.toContain(futureFailed.id);
    expect(claimed).not.toContain(freshProcessing.id); // live lease left alone
    expect(claimed).not.toContain(dead.id);
    expect(result.recovered).toBe(3);
  });

  it('atomic claim prevents double-processing under concurrency', async () => {
    const phone = '27831112222';
    // Pre-create the business so onboarding is an idempotent lookup; without the
    // claim, both racers would still each send a reply.
    await dataSource.manager.save(
      dataSource.manager.create(Business, { name: 'Claim Co', waPhone: phone }),
    );
    const stored = await insert({ status: 'RECEIVED', waFrom: phone });

    let sends = 0;
    const wa = {
      sendText: () => {
        sends++;
        return Promise.resolve();
      },
    } as unknown as WhatsAppClient;
    const service = new IngestionService(
      dataSource,
      new OnboardingService(dataSource),
      new ParsingService(dataSource, new LedgerService(dataSource)),
      nonQueryService(),
      wa,
    );

    await Promise.all([
      service.processMessage(stored.id),
      service.processMessage(stored.id),
    ]);

    const row = await dataSource.manager.findOneOrFail(InboundMessage, {
      where: { id: stored.id },
    });
    expect(row.status).toBe('PROCESSED');
    expect(sends).toBe(1); // exactly one reply, not two
  });

  it('fences an expired worker after a new owner reclaims the lease', async () => {
    const phone = '27831113333';
    const business = await dataSource.manager.save(
      dataSource.manager.create(Business, {
        name: 'Fenced Claim Co',
        waPhone: phone,
      }),
    );
    const staleToken = '00000000-0000-4000-8000-000000000003';
    const stored = await insert({
      status: 'PROCESSING',
      waFrom: phone,
      claimToken: staleToken,
      leaseExpiresAt: new Date(Date.now() - 60_000),
    });

    let releaseOnboarding!: () => void;
    const onboardingGate = new Promise<void>((resolve) => {
      releaseOnboarding = resolve;
    });
    const onboarding = {
      resolveOrCreateBusiness: async () => {
        await onboardingGate;
        return { business, created: false };
      },
    } as unknown as OnboardingService;
    const conversational = {
      handle: () => Promise.resolve({ handled: true, replyBody: 'Hello' }),
    } as unknown as ConversationalQueryService;
    const sendText = jest.fn().mockResolvedValue(undefined);
    const service = new IngestionService(
      dataSource,
      onboarding,
      new ParsingService(dataSource, new LedgerService(dataSource)),
      conversational,
      { sendText },
    );

    const reclaimedWork = service.processMessage(stored.id);
    let current = await dataSource.manager.findOneByOrFail(InboundMessage, {
      id: stored.id,
    });
    for (let i = 0; i < 20 && current.claimToken === staleToken; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      current = await dataSource.manager.findOneByOrFail(InboundMessage, {
        id: stored.id,
      });
    }
    expect(current.claimToken).not.toBe(staleToken);
    expect(current.status).toBe('PROCESSING');

    const staleFinalize = await dataSource.manager.update(
      InboundMessage,
      { id: stored.id, status: 'PROCESSING', claimToken: staleToken },
      { status: 'PROCESSED', claimToken: null, leaseExpiresAt: null },
    );
    expect(staleFinalize.affected).toBe(0);

    releaseOnboarding();
    await reclaimedWork;
    const finalRow = await dataSource.manager.findOneByOrFail(InboundMessage, {
      id: stored.id,
    });
    expect(finalRow.status).toBe('PROCESSED');
    expect(sendText).toHaveBeenCalledTimes(1);
  });

  it('quarantines a signed malformed delivery with its exact raw bytes', async () => {
    const service = new IngestionService(
      dataSource,
      new OnboardingService(dataSource),
      new ParsingService(dataSource, new LedgerService(dataSource)),
      nonQueryService(),
      { sendText: jest.fn().mockResolvedValue(undefined) },
    );
    const malformed = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { messages: [{ type: 'text' }] } }] }],
    };
    const raw = Buffer.from(JSON.stringify(malformed));

    await expect(
      service.ingestWebhook(
        malformed as Parameters<IngestionService['ingestWebhook']>[0],
        raw,
        'sha256=authenticated-signature',
      ),
    ).resolves.toEqual({ stored: 0, duplicates: 0 });

    const delivery = await dataSource.manager.findOneByOrFail(WebhookDelivery, {
      payloadHash: createHash('sha256').update(raw).digest('hex'),
    });
    expect(delivery.status).toBe('QUARANTINED');
    expect(delivery.errorCode).toBe('MALFORMED_MESSAGE');
    expect(delivery.rawBody.equals(raw)).toBe(true);
  });

  it('proposes a simple WhatsApp sale and posts it only after confirmation', async () => {
    const phone = '27839990000';
    const stored = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-phase3-sale',
      waFrom: phone,
      payloadHash: 'a'.repeat(64),
      textBody: 'sold airtime R30',
    });

    const replies: string[] = [];
    const wa = {
      sendText: (_to: string, body: string) => {
        replies.push(body);
        return Promise.resolve();
      },
    };
    const service = new IngestionService(
      dataSource,
      new OnboardingService(dataSource),
      new ParsingService(dataSource, new LedgerService(dataSource)),
      nonQueryService(),
      wa,
    );

    await service.processMessage(stored.id, 'Phase 3 Trader');

    const proposedInbound = await dataSource.manager.findOneOrFail(
      InboundMessage,
      {
        where: { id: stored.id },
      },
    );
    const proposal = await dataSource.manager.findOneOrFail(
      TransactionProposal,
      {
        where: {
          businessId: proposedInbound.businessId,
          sourceWaMessageId: 'wamid-phase3-sale',
        },
      },
    );

    expect(proposedInbound.status).toBe('PROCESSED');
    expect(proposal.status).toBe('PENDING');
    expect(proposal.proposalDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(replies[0]).toContain(
      `ref ${proposal.proposalDigest.slice(0, 12).toUpperCase()}`,
    );
    await expect(
      dataSource.manager.update(TransactionProposal, proposal.id, {
        amountMinor: '999999',
      }),
    ).rejects.toThrow('prompted transaction facts are immutable');
    for (const mutation of [
      `kind = 'EXPENSE'`,
      `amount_minor = 999999`,
      `currency = 'USD'`,
      `description = 'altered proposal'`,
      `source_wa_message_id = 'wamid-altered'`,
      `source_payload_hash = repeat('f', 64)`,
      `wa_timestamp = wa_timestamp + interval '1 second'`,
      `received_at = received_at + interval '1 second'`,
      `business_id = gen_random_uuid()`,
      `proposal_digest = repeat('0', 64)`,
    ]) {
      await expect(
        dataSource.query(
          `UPDATE transaction_proposals SET ${mutation} WHERE id = $1`,
          [proposal.id],
        ),
      ).rejects.toThrow('prompted transaction facts are immutable');
    }

    const proposalAccounts = await dataSource.manager.find(Account, {
      where: { businessId: proposal.businessId },
    });
    const cash = proposalAccounts.find((account) => account.code === '100');
    const sales = proposalAccounts.find((account) => account.code === '400');
    if (!cash || !sales) throw new Error('Proposal account fixture missing');
    const unrelatedTransaction = await new LedgerService(
      dataSource,
    ).postTransaction({
      businessId: proposal.businessId,
      description: 'unrelated transaction',
      currency: 'ZAR',
      idempotencyKey: 'unrelated-proposal-link',
      sourceType: 'API',
      sourcePayloadHash: 'd'.repeat(64),
      occurredAt: new Date('2026-08-03T09:00:00.000Z'),
      receivedAt: new Date('2026-08-03T09:00:01.000Z'),
      entries: [
        { accountId: cash.id, amountMinor: '3000', type: 'DEBIT' },
        { accountId: sales.id, amountMinor: '3000', type: 'CREDIT' },
      ],
    });
    await expect(
      dataSource.manager.update(TransactionProposal, proposal.id, {
        status: 'CONFIRMED',
        confirmedByWaMessageId: 'wamid-forged-confirmation',
        transactionId: unrelatedTransaction.id,
      }),
    ).rejects.toThrow('does not match its posted ledger transaction');
    expect(replies[0]).toContain('Reply YES to record it');
    await expect(
      dataSource.manager.findOne(Transaction, {
        where: { sourceMessageId: 'wamid-phase3-sale' },
      }),
    ).resolves.toBeNull();

    const confirm = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-phase3-confirm',
      waFrom: phone,
      payloadHash: 'b'.repeat(64),
      textBody: 'YES',
    });

    await service.processMessage(confirm.id);

    const inbound = await dataSource.manager.findOneOrFail(InboundMessage, {
      where: { id: stored.id },
    });
    const tx = await dataSource.manager.findOneOrFail(Transaction, {
      where: { sourceMessageId: 'wamid-phase3-sale' },
      relations: { entries: true },
    });

    expect(inbound.status).toBe('PROCESSED');
    expect(inbound.businessId).toBe(tx.businessId);
    expect(tx.sourceType).toBe('WHATSAPP');
    expect(tx.sourcePayloadHash).toBe('a'.repeat(64));
    expect(tx.entries).toHaveLength(2);
    await expect(
      dataSource.manager.findOneOrFail(TransactionProposal, {
        where: { id: proposal.id },
      }),
    ).resolves.toMatchObject({
      status: 'CONFIRMED',
      confirmedByWaMessageId: 'wamid-phase3-confirm',
      transactionId: tx.id,
    });
    expect(replies.at(-1)).toContain('Recorded a sale of R30.00');
  });

  it('rolls back the ledger post when proposal confirmation cannot commit', async () => {
    const phone = '27839990009';
    const proposedInbound = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-atomic-proposal',
      waFrom: phone,
      payloadHash: 'e'.repeat(64),
      textBody: 'sold airtime R45',
    });
    const parsing = new ParsingService(
      dataSource,
      new LedgerService(dataSource),
    );
    const service = new IngestionService(
      dataSource,
      new OnboardingService(dataSource),
      parsing,
      nonQueryService(),
      { sendText: jest.fn().mockResolvedValue(undefined) },
    );
    await service.processMessage(proposedInbound.id, 'Atomic Trader');
    const proposal = await dataSource.manager.findOneByOrFail(
      TransactionProposal,
      { sourceWaMessageId: 'wamid-atomic-proposal' },
    );

    await dataSource.query(`
      CREATE FUNCTION test_reject_proposal_confirmation()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'CONFIRMED' THEN
          RAISE EXCEPTION 'test confirmation rejection';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await dataSource.query(`
      CREATE TRIGGER test_reject_proposal_confirmation
      BEFORE UPDATE ON transaction_proposals
      FOR EACH ROW EXECUTE FUNCTION test_reject_proposal_confirmation();
    `);
    try {
      await expect(
        parsing.parseAndPost({
          businessId: proposal.businessId,
          waMessageId: 'wamid-atomic-confirm',
          payloadHash: 'f'.repeat(64),
          textBody: 'YES',
          messageType: 'text',
          waTimestamp: new Date('2026-08-03T10:00:00.000Z'),
          receivedAt: new Date('2026-08-03T10:00:01.000Z'),
        }),
      ).rejects.toThrow('test confirmation rejection');
    } finally {
      await dataSource.query(
        `DROP TRIGGER IF EXISTS test_reject_proposal_confirmation ON transaction_proposals;`,
      );
      await dataSource.query(
        `DROP FUNCTION IF EXISTS test_reject_proposal_confirmation();`,
      );
    }

    await expect(
      dataSource.manager.findOne(Transaction, {
        where: { sourceMessageId: 'wamid-atomic-proposal' },
      }),
    ).resolves.toBeNull();
    await expect(
      dataSource.manager.findOneByOrFail(TransactionProposal, {
        id: proposal.id,
      }),
    ).resolves.toMatchObject({ status: 'PENDING', transactionId: null });
  });

  it("does not process a confirmation ahead of the sender's earlier proposal", async () => {
    const phone = '27839990111';
    const proposalMessage = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-ordered-proposal',
      waFrom: phone,
      payloadHash: 'a'.repeat(64),
      textBody: 'sold airtime R30',
    });
    const confirmationMessage = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-ordered-confirmation',
      waFrom: phone,
      payloadHash: 'b'.repeat(64),
      textBody: 'YES',
    });
    const sendText = jest.fn().mockResolvedValue(undefined);
    const service = new IngestionService(
      dataSource,
      new OnboardingService(dataSource),
      new ParsingService(dataSource, new LedgerService(dataSource)),
      nonQueryService(),
      { sendText },
    );

    await expect(service.processMessage(confirmationMessage.id)).resolves.toBe(
      false,
    );
    await expect(service.processMessage(proposalMessage.id)).resolves.toBe(
      true,
    );
    await expect(service.processMessage(confirmationMessage.id)).resolves.toBe(
      true,
    );

    const proposal = await dataSource.manager.findOneByOrFail(
      TransactionProposal,
      { sourceWaMessageId: proposalMessage.waMessageId },
    );
    expect(proposal.status).toBe('CONFIRMED');
    expect(sendText).toHaveBeenCalledTimes(2);
  });

  it('serializes same-sender insertion across connections before assigning order', async () => {
    const phone = '27839990222';
    await dataSource.manager.save(
      dataSource.manager.create(Business, {
        name: 'Insertion Order Co',
        waPhone: phone,
      }),
    );
    const firstConnection = dataSource.createQueryRunner();
    await firstConnection.connect();
    await firstConnection.startTransaction();
    try {
      await firstConnection.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
        [`inbound-sender:${phone}`],
      );
      const first = await firstConnection.manager.save(
        firstConnection.manager.create(InboundMessage, {
          waMessageId: 'wamid-insertion-first',
          waFrom: phone,
          payload: { type: 'text' },
          payloadHash: 'a'.repeat(64),
          messageType: 'text',
          textBody: 'hello first',
          waTimestamp: new Date('2026-07-31T10:00:00.000Z'),
          status: 'RECEIVED',
        }),
      );

      const sendText = jest.fn().mockResolvedValue(undefined);
      const conversational = {
        handle: jest.fn().mockResolvedValue({
          handled: true,
          replyBody: 'Hello',
        }),
      } as unknown as ConversationalQueryService;
      const service = new IngestionService(
        dataSource,
        new OnboardingService(dataSource),
        new ParsingService(dataSource, new LedgerService(dataSource)),
        conversational,
        { sendText },
      );
      const secondPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: 'wamid-insertion-second',
                      from: phone,
                      timestamp: '1785492060',
                      type: 'text',
                      text: { body: 'hello second' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const secondInsert = service.ingestWebhook(
        secondPayload,
        Buffer.from(JSON.stringify(secondPayload)),
      );
      let secondResolved = false;
      void secondInsert.finally(() => {
        secondResolved = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(secondResolved).toBe(false);

      await firstConnection.commitTransaction();
      await secondInsert;

      const second = await dataSource.manager.findOneByOrFail(InboundMessage, {
        waMessageId: 'wamid-insertion-second',
      });
      expect(BigInt(second.ingestSequence)).toBeGreaterThan(
        BigInt(first.ingestSequence),
      );
      await expect(service.processMessage(second.id)).resolves.toBe(false);
      await expect(service.processMessage(first.id)).resolves.toBe(true);
      await expect(service.processMessage(second.id)).resolves.toBe(true);
    } finally {
      if (firstConnection.isTransactionActive) {
        await firstConnection.rollbackTransaction().catch(() => undefined);
      }
      await firstConnection.release();
    }
  });
});

function nonQueryService(): ConversationalQueryService {
  return {
    handle: jest.fn().mockResolvedValue({
      handled: false,
      route: 'TRANSACTION',
    }),
  } as unknown as ConversationalQueryService;
}
