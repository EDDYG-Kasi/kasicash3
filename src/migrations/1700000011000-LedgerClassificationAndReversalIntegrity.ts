import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Protects historical classification and completes the reversal relationship.
 * Account code/type are economic facts once referenced, and every reversal must
 * be a same-currency POSTED mirror whose original is REVERSED at commit.
 */
export class LedgerClassificationAndReversalIntegrity1700000011000 implements MigrationInterface {
  name = 'LedgerClassificationAndReversalIntegrity1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_supported_currency"
      CHECK ("currency" IN ('ZAR', 'USD', 'JPY', 'BHD'));
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_referenced_account_reclassification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM entries WHERE account_id = OLD.id)
           AND (
             NEW.business_id IS DISTINCT FROM OLD.business_id
             OR NEW.code IS DISTINCT FROM OLD.code
             OR NEW.type IS DISTINCT FROM OLD.type
           ) THEN
          RAISE EXCEPTION 'Ledger integrity violation: referenced account business_id, code, and type are immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER prevent_referenced_account_reclassification
      BEFORE UPDATE ON accounts
      FOR EACH ROW
      EXECUTE FUNCTION prevent_referenced_account_reclassification();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_reversed_has_reversal()
      RETURNS TRIGGER AS $$
      DECLARE
        current_status varchar;
        current_currency varchar(3);
        current_business_id uuid;
      BEGIN
        SELECT status, currency, business_id
          INTO current_status, current_currency, current_business_id
        FROM transactions
        WHERE id = NEW.id;

        IF current_status = 'REVERSED' THEN
          IF NOT EXISTS (
            SELECT 1
            FROM transactions r
            WHERE r.reversal_of_transaction_id = NEW.id
              AND r.business_id = current_business_id
              AND r.status = 'POSTED'
              AND r.currency = current_currency
          ) THEN
            RAISE EXCEPTION 'Ledger integrity violation: transaction % marked REVERSED without a POSTED same-currency reversal', NEW.id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_posted_reversal_has_reversed_original()
      RETURNS TRIGGER AS $$
      DECLARE
        current_row record;
        original_row record;
      BEGIN
        SELECT id, business_id, currency, status, reversal_of_transaction_id
          INTO current_row
        FROM transactions
        WHERE id = NEW.id;

        IF current_row.reversal_of_transaction_id IS NOT NULL THEN
          SELECT id, business_id, currency, status
            INTO original_row
          FROM transactions
          WHERE id = current_row.reversal_of_transaction_id;

          IF original_row.id IS NULL
             OR current_row.status <> 'POSTED'
             OR original_row.status <> 'REVERSED'
             OR current_row.business_id IS DISTINCT FROM original_row.business_id
             OR current_row.currency IS DISTINCT FROM original_row.currency THEN
            RAISE EXCEPTION 'Ledger integrity violation: posted reversal % must match a REVERSED same-business, same-currency original', NEW.id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_posted_reversal_has_reversed_original
      AFTER INSERT OR UPDATE ON transactions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_posted_reversal_has_reversed_original();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS enforce_posted_reversal_has_reversed_original ON transactions;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_posted_reversal_has_reversed_original;`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_reversed_has_reversal()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'REVERSED' THEN
          IF NOT EXISTS (
            SELECT 1 FROM transactions r
            WHERE r.reversal_of_transaction_id = NEW.id
              AND r.business_id = NEW.business_id
              AND r.status = 'POSTED'
          ) THEN
            RAISE EXCEPTION 'Ledger integrity violation: Transaction % marked REVERSED without a POSTED same-business reversal', NEW.id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_referenced_account_reclassification ON accounts;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_referenced_account_reclassification;`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_supported_currency";`,
    );
  }
}
