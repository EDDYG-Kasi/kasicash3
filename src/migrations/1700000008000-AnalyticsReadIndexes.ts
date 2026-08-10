import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 visual analytics are live read-only aggregations over posted ledger
 * entries. These indexes support time-series scans and account breakdown joins
 * without adding any derived financial state.
 */
export class AnalyticsReadIndexes1700000008000 implements MigrationInterface {
  name = 'AnalyticsReadIndexes1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_analytics_posted_business_currency_occurred"
      ON "transactions" ("business_id", "currency", "occurred_at", "id")
      WHERE "status" IN ('POSTED', 'REVERSED');
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_entries_analytics_business_transaction_account"
      ON "entries" ("business_id", "transaction_id", "account_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_entries_analytics_business_transaction_account";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_transactions_analytics_posted_business_currency_occurred";`,
    );
  }
}
