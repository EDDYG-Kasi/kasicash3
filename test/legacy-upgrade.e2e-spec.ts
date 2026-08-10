import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';
import { LegacyIntegrityPreflight1700000014500 } from '../src/migrations/1700000014500-LegacyIntegrityPreflight';

describe('Legacy integrity upgrade path', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const preflightIndex = KASICASH_MIGRATIONS.indexOf(
      LegacyIntegrityPreflight1700000014500,
    );
    const legacySource = makeDataSource(
      KASICASH_MIGRATIONS.slice(0, preflightIndex),
    );
    await legacySource.initialize();
    await legacySource.runMigrations({ transaction: 'each' });
    await seedLegacyRows(legacySource);
    await legacySource.destroy();

    dataSource = makeDataSource(KASICASH_MIGRATIONS);
    await dataSource.initialize();
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('canonicalizes safe forms, blocks ambiguity, then succeeds after explicit remediation', async () => {
    await expect(
      dataSource.runMigrations({ transaction: 'each' }),
    ).rejects.toThrow('Legacy integrity preflight blocked migration');

    const diagnostics = await dataSource.query<
      Array<{ category: string; rowCount: string }>
    >(`
      SELECT category, row_count::text AS "rowCount"
      FROM legacy_integrity_preflight
      WHERE row_count > 0
      ORDER BY category;
    `);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        { category: 'TRANSACTION_INVALID_SOURCE_HASH', rowCount: '1' },
        { category: 'TRANSACTION_INVALID_SOURCE_TYPE', rowCount: '1' },
      ]),
    );

    const canonical = await dataSource.query<
      Array<{ sourceType: string; sourcePayloadHash: string }>
    >(`
      SELECT source_type AS "sourceType", source_payload_hash AS "sourcePayloadHash"
      FROM transactions
      WHERE idempotency_key = 'legacy-canonical';
    `);
    expect(canonical[0]).toEqual({
      sourceType: 'API',
      sourcePayloadHash: 'a'.repeat(64),
    });

    await dataSource.query(
      `ALTER TABLE transactions DISABLE TRIGGER prevent_transaction_update_delete;`,
    );
    try {
      await dataSource.query(
        `UPDATE transactions
         SET source_type = 'API', source_payload_hash = $1
         WHERE idempotency_key = 'legacy-ambiguous';`,
        ['b'.repeat(64)],
      );
    } finally {
      await dataSource.query(
        `ALTER TABLE transactions ENABLE TRIGGER prevent_transaction_update_delete;`,
      );
    }
    await dataSource.query(`SELECT refresh_legacy_integrity_preflight();`);

    const applied = await dataSource.runMigrations({ transaction: 'each' });
    expect(applied.length).toBeGreaterThan(0);
    await expect(dataSource.showMigrations()).resolves.toBe(false);

    const proposals = await dataSource.query<
      Array<{ kind: string; sourcePayloadHash: string; proposalDigest: string }>
    >(`
      SELECT kind,
             source_payload_hash AS "sourcePayloadHash",
             proposal_digest AS "proposalDigest"
      FROM transaction_proposals;
    `);
    expect(proposals[0]).toEqual({
      kind: 'SALE',
      sourcePayloadHash: 'c'.repeat(64),
      proposalDigest: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });
  });

  function makeDataSource(migrations: typeof KASICASH_MIGRATIONS): DataSource {
    return new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: KASICASH_ENTITIES,
      migrations,
      migrationsTransactionMode: 'each',
      synchronize: false,
    });
  }
});

async function seedLegacyRows(dataSource: DataSource): Promise<void> {
  const [business] = await dataSource.query<Array<{ id: string }>>(
    `INSERT INTO businesses (name) VALUES ('Legacy fixture') RETURNING id;`,
  );
  const accounts = await dataSource.query<Array<{ id: string; code: string }>>(
    `INSERT INTO accounts (business_id, code, name, type)
     VALUES ($1, '100', 'Cash', 'ASSET'), ($1, '400', 'Sales', 'REVENUE')
     RETURNING id, code;`,
    [business.id],
  );
  const cashId = accounts.find((account) => account.code === '100')?.id;
  const salesId = accounts.find((account) => account.code === '400')?.id;
  if (!cashId || !salesId) throw new Error('Legacy fixture accounts missing');

  await insertLegacyTransaction(
    dataSource,
    business.id,
    cashId,
    salesId,
    'legacy-canonical',
    ' api ',
    'A'.repeat(64),
  );
  await insertLegacyTransaction(
    dataSource,
    business.id,
    cashId,
    salesId,
    'legacy-ambiguous',
    'EMAIL',
    'legacy-hash',
  );
  await dataSource.query(
    `INSERT INTO transaction_proposals (
       business_id, source_wa_message_id, source_payload_hash, kind,
       amount_minor, currency, description, wa_timestamp, received_at, status
     ) VALUES ($1, 'legacy-proposal', $2, 'sale', 1000, 'ZAR',
       'legacy proposal', now(), now(), 'PENDING');`,
    [business.id, 'C'.repeat(64)],
  );
}

async function insertLegacyTransaction(
  dataSource: DataSource,
  businessId: string,
  cashId: string,
  salesId: string,
  idempotencyKey: string,
  sourceType: string,
  sourcePayloadHash: string,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const [transaction] = await manager.query<Array<{ id: string }>>(
      `INSERT INTO transactions (
         business_id, description, currency, idempotency_key, source_type,
         source_message_id, source_payload_hash, occurred_at, received_at,
         posted_at, status
       ) VALUES ($1, 'legacy sale', 'ZAR', $2, $3, $4, $5,
         now(), now(), now(), 'POSTING') RETURNING id;`,
      [
        businessId,
        idempotencyKey,
        sourceType,
        `message-${idempotencyKey}`,
        sourcePayloadHash,
      ],
    );
    await manager.query(
      `INSERT INTO entries
         (business_id, transaction_id, account_id, amount_minor, type)
       VALUES ($1, $2, $3, 1000, 'DEBIT'),
              ($1, $2, $4, 1000, 'CREDIT');`,
      [businessId, transaction.id, cashId, salesId],
    );
    await manager.query(
      `UPDATE transactions SET status = 'POSTED' WHERE id = $1;`,
      [transaction.id],
    );
  });
}
