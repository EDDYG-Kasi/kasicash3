import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImmutabilityTriggers1700000000000 implements MigrationInterface {
  name = 'ImmutabilityTriggers1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Prevent Entries from being updated or deleted
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION prevent_entry_mutation()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION 'Immutable record violation: Entries cannot be updated or deleted';
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER prevent_entry_update
            BEFORE UPDATE ON entries
            FOR EACH ROW
            EXECUTE FUNCTION prevent_entry_mutation();
        `);

    await queryRunner.query(`
            CREATE TRIGGER prevent_entry_delete
            BEFORE DELETE ON entries
            FOR EACH ROW
            EXECUTE FUNCTION prevent_entry_mutation();
        `);

    // 2. Prevent Transactions from being deleted, or having economic fields updated
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'Immutable record violation: Transactions cannot be deleted';
                END IF;

                -- Check if economic fields changed
                IF NEW.description != OLD.description OR
                   NEW.currency != OLD.currency OR
                   NEW.occurred_at != OLD.occurred_at THEN
                    RAISE EXCEPTION 'Immutable record violation: Economic fields of transactions cannot be modified';
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE TRIGGER prevent_transaction_update_delete
            BEFORE UPDATE OR DELETE ON transactions
            FOR EACH ROW
            EXECUTE FUNCTION prevent_transaction_mutation();
        `);

    // 3. Deferred constraint for balancing
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION enforce_balanced_transaction()
            RETURNS TRIGGER AS $$
            DECLARE
                total_debits bigint;
                total_credits bigint;
                entry_count int;
            BEGIN
                SELECT
                    COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_minor ELSE 0 END), 0),
                    COUNT(*)
                INTO total_debits, total_credits, entry_count
                FROM entries
                WHERE transaction_id = NEW.transaction_id;

                IF entry_count < 2 THEN
                    RAISE EXCEPTION 'Double-entry violation: Transaction % has fewer than 2 entries', NEW.transaction_id;
                END IF;

                IF total_debits != total_credits THEN
                    RAISE EXCEPTION 'Double-entry violation: Transaction % is unbalanced (Debits: %, Credits: %)', NEW.transaction_id, total_debits, total_credits;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

    await queryRunner.query(`
            CREATE CONSTRAINT TRIGGER enforce_balance
            AFTER INSERT OR UPDATE ON entries
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW
            EXECUTE FUNCTION enforce_balanced_transaction();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS enforce_balance ON entries;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_balanced_transaction;`,
    );

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_transaction_update_delete ON transactions;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_transaction_mutation;`,
    );

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_entry_update ON entries;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_entry_delete ON entries;`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_entry_mutation;`);
  }
}
