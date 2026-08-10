import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import {
  KASICASH_ENTITIES,
  KASICASH_MIGRATIONS,
} from '../src/database/database-options';

describe('Database migration catalog', () => {
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
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  it('runs, fully reverts, and reruns the exact production catalog', async () => {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    expect(applied).toHaveLength(KASICASH_MIGRATIONS.length);
    await expect(dataSource.showMigrations()).resolves.toBe(false);
    const currencies = await dataSource.query<Array<{ code: string }>>(
      `SELECT code FROM supported_currencies ORDER BY code`,
    );
    expect(currencies.map((row) => row.code)).toEqual([
      'BHD',
      'JPY',
      'USD',
      'ZAR',
    ]);
    const currencyForeignKeys = await dataSource.query<
      Array<{ constraintName: string }>
    >(`
      SELECT conname AS "constraintName"
      FROM pg_constraint
      WHERE conname IN (
        'FK_transactions_supported_currency',
        'FK_transaction_proposals_supported_currency',
        'FK_auth_principals_supported_currency',
        'FK_anomaly_alerts_supported_currency'
      )
      ORDER BY conname
    `);
    expect(currencyForeignKeys).toHaveLength(4);

    const [downgradeBusiness] = await dataSource.query<Array<{ id: string }>>(
      `INSERT INTO businesses (name) VALUES ('Downgrade guard fixture') RETURNING id;`,
    );
    await dataSource.query(
      `INSERT INTO anomaly_alerts (
         business_id, anomaly_key, anomaly_type, currency, timezone,
         period_start_local, period_end_local, payload, status
       ) VALUES ($1, 'downgrade-guard', 'SALES_SPIKE', 'ZAR',
         'Africa/Johannesburg', '2026-08-01', '2026-08-01', '{}'::jsonb,
         'DELIVERY_UNCERTAIN');`,
      [downgradeBusiness.id],
    );
    await expect(
      dataSource.undoLastMigration({ transaction: 'each' }),
    ).rejects.toThrow('Downgrade blocked');
    await dataSource.query(
      `DELETE FROM anomaly_alerts WHERE anomaly_key = 'downgrade-guard';`,
    );
    await dataSource.query(`DELETE FROM businesses WHERE id = $1;`, [
      downgradeBusiness.id,
    ]);

    for (let index = 0; index < KASICASH_MIGRATIONS.length; index++) {
      await dataSource.undoLastMigration({ transaction: 'each' });
    }
    const [{ ledgerTable }] = await dataSource.query<
      Array<{ ledgerTable: string | null }>
    >(`SELECT to_regclass('public.transactions') AS "ledgerTable"`);
    expect(ledgerTable).toBeNull();
    await expect(dataSource.showMigrations()).resolves.toBe(true);

    const reapplied = await dataSource.runMigrations({ transaction: 'each' });
    expect(reapplied).toHaveLength(KASICASH_MIGRATIONS.length);
    await expect(dataSource.showMigrations()).resolves.toBe(false);
  });
});
