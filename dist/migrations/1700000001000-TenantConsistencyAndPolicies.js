"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantConsistencyAndPolicies1700000001000 = void 0;
class TenantConsistencyAndPolicies1700000001000 {
    name = 'TenantConsistencyAndPolicies1700000001000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "entries" ADD COLUMN "business_id" uuid;`);
        await queryRunner.query(`
      UPDATE "entries" e
      SET "business_id" = t."business_id"
      FROM "transactions" t
      WHERE e."transaction_id" = t."id";
    `);
        await queryRunner.query(`ALTER TABLE "entries" ALTER COLUMN "business_id" SET NOT NULL;`);
        await queryRunner.query(`CREATE INDEX "IDX_entries_business_id" ON "entries" ("business_id");`);
        await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "UQ_accounts_business_id_id" UNIQUE ("business_id", "id");
    `);
        await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "UQ_transactions_business_id_id" UNIQUE ("business_id", "id");
    `);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_entries_transaction";`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT "FK_entries_account";`);
        await queryRunner.query(`
      ALTER TABLE "entries"
      ADD CONSTRAINT "FK_entries_transaction_business"
        FOREIGN KEY ("business_id", "transaction_id")
        REFERENCES "transactions" ("business_id", "id") ON DELETE RESTRICT;
    `);
        await queryRunner.query(`
      ALTER TABLE "entries"
      ADD CONSTRAINT "FK_entries_account_business"
        FOREIGN KEY ("business_id", "account_id")
        REFERENCES "accounts" ("business_id", "id") ON DELETE RESTRICT;
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_transaction_has_entries()
      RETURNS TRIGGER AS $$
      DECLARE
        entry_count int;
      BEGIN
        SELECT COUNT(*) INTO entry_count FROM entries WHERE transaction_id = NEW.id;
        IF entry_count < 1 THEN
          RAISE EXCEPTION 'Ledger integrity violation: Transaction % committed with no entries', NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_transaction_has_entries
      AFTER INSERT ON transactions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_transaction_has_entries();
    `);
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Immutable record violation: Transactions cannot be deleted';
        END IF;

        -- Economic and provenance fields are frozen (NULL-safe comparison).
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

        -- Only lifecycle transition permitted: POSTED -> REVERSED.
        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'POSTED' AND NEW.status = 'REVERSED') THEN
          RAISE EXCEPTION 'Immutable record violation: Invalid status transition % -> %', OLD.status, NEW.status;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_transaction_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Immutable record violation: Transactions cannot be deleted';
        END IF;

        IF NEW.description != OLD.description OR
           NEW.currency != OLD.currency OR
           NEW.occurred_at != OLD.occurred_at THEN
          RAISE EXCEPTION 'Immutable record violation: Economic fields of transactions cannot be modified';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await queryRunner.query(`DROP TRIGGER IF EXISTS enforce_transaction_has_entries ON transactions;`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_transaction_has_entries;`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT IF EXISTS "FK_entries_account_business";`);
        await queryRunner.query(`ALTER TABLE "entries" DROP CONSTRAINT IF EXISTS "FK_entries_transaction_business";`);
        await queryRunner.query(`
      ALTER TABLE "entries"
      ADD CONSTRAINT "FK_entries_account"
        FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE RESTRICT;
    `);
        await queryRunner.query(`
      ALTER TABLE "entries"
      ADD CONSTRAINT "FK_entries_transaction"
        FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id") ON DELETE RESTRICT;
    `);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "UQ_transactions_business_id_id";`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "UQ_accounts_business_id_id";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entries_business_id";`);
        await queryRunner.query(`ALTER TABLE "entries" DROP COLUMN IF EXISTS "business_id";`);
    }
}
exports.TenantConsistencyAndPolicies1700000001000 = TenantConsistencyAndPolicies1700000001000;
//# sourceMappingURL=1700000001000-TenantConsistencyAndPolicies.js.map