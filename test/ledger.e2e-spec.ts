/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { LedgerService } from '../src/ledger/ledger.service';
import { Business } from '../src/ledger/entities/business.entity';
import { Account, AccountType } from '../src/ledger/entities/account.entity';
import { Transaction } from '../src/ledger/entities/transaction.entity';
import { Entry } from '../src/ledger/entities/entry.entity';
import { InboundMessage } from '../src/ingestion/entities/inbound-message.entity';
import { RecoveryService } from '../src/ingestion/recovery.service';
import { IngestionService } from '../src/ingestion/ingestion.service';
import { OnboardingService } from '../src/ingestion/onboarding.service';
import { ParsingService } from '../src/parsing/parsing.service';
import type { WhatsAppClient } from '../src/ingestion/whatsapp.client';
import { CreateLedgerCore1699999999000 } from '../src/migrations/1699999999000-CreateLedgerCore';
import { ImmutabilityTriggers1700000000000 } from '../src/migrations/1700000000000-ImmutabilityTriggers';
import { TenantConsistencyAndPolicies1700000001000 } from '../src/migrations/1700000001000-TenantConsistencyAndPolicies';
import { PostingLifecycle1700000002000 } from '../src/migrations/1700000002000-PostingLifecycle';
import { LedgerHardening1700000003000 } from '../src/migrations/1700000003000-LedgerHardening';
import { InboundMessages1700000004000 } from '../src/migrations/1700000004000-InboundMessages';
import { InboundRetryColumns1700000005000 } from '../src/migrations/1700000005000-InboundRetryColumns';

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
    sourcePayloadHash: 'hash-default',
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
      entities: [Business, Account, Transaction, Entry, InboundMessage],
      migrations: [
        CreateLedgerCore1699999999000,
        ImmutabilityTriggers1700000000000,
        TenantConsistencyAndPolicies1700000001000,
        PostingLifecycle1700000002000,
        LedgerHardening1700000003000,
        InboundMessages1700000004000,
        InboundRetryColumns1700000005000,
      ],
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

  it('blocks entry deletes', async () => {
    const tx = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'imm-2' }),
    );
    await expect(
      dataSource.manager.delete(Entry, tx.entries[0].id),
    ).rejects.toThrow('Entries cannot be updated or deleted');
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
          sourcePayloadHash: 'H',
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
        [businessA.id, 'Empty', 'ZAR', 'empty-1', 'API', 'H'],
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
         VALUES ($1,'x','ZAR','xb-1','API','H','POSTING',now(),now()) RETURNING id`,
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

  it('rejects a transaction inserted directly as REVERSED', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `INSERT INTO transactions (business_id, description, currency, idempotency_key, source_type, source_payload_hash, status, occurred_at, received_at)
         VALUES ($1,'x','ZAR','rev-direct','API','H','REVERSED',now(),now())`,
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
         VALUES ($1,'x','ZAR','stuck-posting','API','H','POSTING',now(),now()) RETURNING id`,
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

  it('rejects a raw reversal pointing at another reversal (reversal-of-reversal)', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rr-src' }),
    );
    const reversal = await ledgerService.reverseTransaction(
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
      sourcePayloadHash: 'H1',
    });
    const first = await ledgerService.postTransaction(dto);
    const second = await ledgerService.postTransaction(dto);
    expect(second.id).toBe(first.id);
  });

  it('throws Conflict on duplicate idempotency key with a different payload hash', async () => {
    await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'idem-diff', sourcePayloadHash: 'H1' }),
    );
    await expect(
      ledgerService.postTransaction(
        baseDto({ idempotencyKey: 'idem-diff', sourcePayloadHash: 'H2' }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reverses a transaction with inverted entries and marks the original REVERSED', async () => {
    const original = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-1' }),
    );
    const reversal = await ledgerService.reverseTransaction(
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

  it('reversal idempotency only returns the existing reversal for the same original; conflicts otherwise', async () => {
    const original1 = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-2a' }),
    );
    const original2 = await ledgerService.postTransaction(
      baseDto({ idempotencyKey: 'rev-src-2b' }),
    );

    const r1 = await ledgerService.reverseTransaction(
      original1.id,
      'rev-key-2',
      'Refund',
    );
    const r1Again = await ledgerService.reverseTransaction(
      original1.id,
      'rev-key-2',
      'Refund',
    );
    expect(r1Again.id).toBe(r1.id);

    await expect(
      ledgerService.reverseTransaction(original2.id, 'rev-key-2', 'Refund'),
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
      entities: [Business, Account, Transaction, Entry, InboundMessage],
      migrations: [
        CreateLedgerCore1699999999000,
        ImmutabilityTriggers1700000000000,
        TenantConsistencyAndPolicies1700000001000,
        PostingLifecycle1700000002000,
        LedgerHardening1700000003000,
        InboundMessages1700000004000,
        InboundRetryColumns1700000005000,
      ],
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
        payloadHash: 'h',
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
      nextRetryAt: new Date(now - 60_000),
    });
    const freshProcessing = await insert({
      status: 'PROCESSING',
      nextRetryAt: new Date(now + 5 * 60_000),
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

  it('parses a simple WhatsApp sale and posts it to the ledger', async () => {
    const phone = '27839990000';
    const stored = await insert({
      status: 'RECEIVED',
      waMessageId: 'wamid-phase3-sale',
      waFrom: phone,
      payloadHash: 'phase3-hash-1',
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
      wa,
    );

    await service.processMessage(stored.id, 'Phase 3 Trader');

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
    expect(tx.sourcePayloadHash).toBe('phase3-hash-1');
    expect(tx.entries).toHaveLength(2);
    expect(replies[0]).toContain('Recorded a sale of R30.00');
  });
});
