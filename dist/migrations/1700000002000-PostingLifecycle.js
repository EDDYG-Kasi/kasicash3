"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingLifecycle1700000002000 = void 0;
class PostingLifecycle1700000002000 {
    name = 'PostingLifecycle1700000002000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_status";`);
        await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_status"
      CHECK ("status" IN ('POSTING', 'POSTED', 'REVERSED'));
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_entry_insert_on_posted()
      RETURNS TRIGGER AS $$
      DECLARE
        parent_status varchar;
      BEGIN
        SELECT status INTO parent_status FROM transactions WHERE id = NEW.transaction_id;
        IF parent_status IS DISTINCT FROM 'POSTING' THEN
          RAISE EXCEPTION 'Immutable record violation: entries may only be added while a transaction is POSTING (transaction % is %)', NEW.transaction_id, parent_status;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`
      CREATE TRIGGER prevent_entry_insert_on_posted
      BEFORE INSERT ON entries
      FOR EACH ROW
      EXECUTE FUNCTION prevent_entry_insert_on_posted();
    `);
        await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_external_payload_hash"
      CHECK ("source_type" = 'SYSTEM' OR "source_payload_hash" IS NOT NULL);
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Immutable record violation: Transactions cannot be deleted';
        END IF;

        IF NEW.description         IS DISTINCT FROM OLD.description
        OR NEW.currency            IS DISTINCT FROM OLD.currency
        OR NEW.occurred_at         IS DISTINCT FROM OLD.occurred_at
        OR NEW.received_at         IS DISTINCT FROM OLD.received_at
        OR NEW.posted_at           IS DISTINCT FROM OLD.posted_at
        OR NEW.created_at          IS DISTINCT FROM OLD.created_at
        OR NEW.idempotency_key     IS DISTINCT FROM OLD.idempotency_key
        OR NEW.source_type         IS DISTINCT FROM OLD.source_type
        OR NEW.source_message_id   IS DISTINCT FROM OLD.source_message_id
        OR NEW.source_payload_hash IS DISTINCT FROM OLD.source_payload_hash
        OR NEW.business_id         IS DISTINCT FROM OLD.business_id
        OR NEW.reversal_of_transaction_id IS DISTINCT FROM OLD.reversal_of_transaction_id THEN
          RAISE EXCEPTION 'Immutable record violation: Economic fields of transactions cannot be modified';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'POSTING' AND NEW.status = 'POSTED')
           AND NOT (OLD.status = 'POSTED'  AND NEW.status = 'REVERSED') THEN
          RAISE EXCEPTION 'Immutable record violation: Invalid status transition % -> %', OLD.status, NEW.status;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_reversed_has_reversal()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'REVERSED' THEN
          IF NOT EXISTS (
            SELECT 1 FROM transactions r WHERE r.reversal_of_transaction_id = NEW.id
          ) THEN
            RAISE EXCEPTION 'Ledger integrity violation: Transaction % marked REVERSED without a reversal transaction', NEW.id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_reversed_has_reversal
      AFTER INSERT OR UPDATE ON transactions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_reversed_has_reversal();
    `);
        await queryRunner.query(`CREATE INDEX "IDX_entries_business_transaction" ON "entries" ("business_id", "transaction_id");`);
        await queryRunner.query(`CREATE INDEX "IDX_entries_business_account" ON "entries" ("business_id", "account_id");`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entries_business_account";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entries_business_transaction";`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS enforce_reversed_has_reversal ON transactions;`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_reversed_has_reversal;`);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Immutable record violation: Transactions cannot be deleted';
        END IF;

        IF NEW.description         IS DISTINCT FROM OLD.description
        OR NEW.currency            IS DISTINCT FROM OLD.currency
        OR NEW.occurred_at         IS DISTINCT FROM OLD.occurred_at
        OR NEW.received_at         IS DISTINCT FROM OLD.received_at
        OR NEW.posted_at           IS DISTINCT FROM OLD.posted_at
        OR NEW.idempotency_key     IS DISTINCT FROM OLD.idempotency_key
        OR NEW.source_type         IS DISTINCT FROM OLD.source_type
        OR NEW.source_message_id   IS DISTINCT FROM OLD.source_message_id
        OR NEW.source_payload_hash IS DISTINCT FROM OLD.source_payload_hash
        OR NEW.business_id         IS DISTINCT FROM OLD.business_id
        OR NEW.reversal_of_transaction_id IS DISTINCT FROM OLD.reversal_of_transaction_id THEN
          RAISE EXCEPTION 'Immutable record violation: Economic fields of transactions cannot be modified';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'POSTED' AND NEW.status = 'REVERSED') THEN
          RAISE EXCEPTION 'Immutable record violation: Invalid status transition % -> %', OLD.status, NEW.status;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_external_payload_hash";`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_entry_insert_on_posted ON entries;`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_entry_insert_on_posted;`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_status";`);
        await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_status"
      CHECK ("status" IN ('POSTED', 'REVERSED'));
    `);
    }
}
exports.PostingLifecycle1700000002000 = PostingLifecycle1700000002000;
//# sourceMappingURL=1700000002000-PostingLifecycle.js.map