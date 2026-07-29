import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 reports are read-only aggregations over posted ledger entries.
 * These indexes support business/currency/period report filters without
 * changing ledger invariants or storing report caches.
 */
export class ReportReadIndexes1700000006000 implements MigrationInterface {
  name = 'ReportReadIndexes1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_reports_business_status_currency_occurred"
      ON "transactions" ("business_id", "status", "currency", "occurred_at", "id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_entries_reports_business_account_transaction"
      ON "entries" ("business_id", "account_id", "transaction_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_accounts_reports_business_code_type"
      ON "accounts" ("business_id", "code", "type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_accounts_reports_business_code_type";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_entries_reports_business_account_transaction";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_transactions_reports_business_status_currency_occurred";`,
    );
  }
}
