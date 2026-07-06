import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Final Phase 1 DB hardening on top of PostingLifecycle:
 *
 *  1. No committed POSTING rows: a transaction may not be committed while still
 *     POSTING (would otherwise remain open to further entries). Checked deferred,
 *     reading the row's CURRENT status at commit (not the triggering snapshot),
 *     so the normal POSTING -> POSTED flow passes.
 *  2. REVERSED requires a valid reversal: the reversal row must be same-business
 *     and POSTED. Backed by a composite self-FK so a reversal can only point at a
 *     same-business original.
 *  3. Non-empty invariants: payload hash (external), idempotency_key, source_type
 *     cannot be empty/whitespace at the DB level.
 *
 * Runs after 1700000002000-PostingLifecycle.
 */
export class LedgerHardening1700000003000 implements MigrationInterface {
  name = 'LedgerHardening1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. No committed POSTING rows (deferred, current-row lookup) ----
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_no_committed_posting()
      RETURNS TRIGGER AS $$
      DECLARE
        current_status varchar;
      BEGIN
        SELECT status INTO current_status FROM transactions WHERE id = NEW.id;
        IF current_status = 'POSTING' THEN
          RAISE EXCEPTION 'Ledger integrity violation: transaction % may not be committed in POSTING state', NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_no_committed_posting
      AFTER INSERT OR UPDATE ON transactions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_no_committed_posting();
    `);

    // ---- 2. Same-business self-FK + stricter REVERSED check ----
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_reversal_of";`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_reversal_same_business"
        FOREIGN KEY ("business_id", "reversal_of_transaction_id")
        REFERENCES "transactions" ("business_id", "id") ON DELETE RESTRICT;
    `);
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

    // A reversal may only point at a non-reversal original (mirrors the service rule).
    // INSERT-only: reversal_of_transaction_id is frozen post-insert by prevent_transaction_mutation.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_reversal_of_reversal()
      RETURNS TRIGGER AS $$
      DECLARE
        target_reversal_id uuid;
      BEGIN
        IF NEW.reversal_of_transaction_id IS NOT NULL THEN
          SELECT reversal_of_transaction_id INTO target_reversal_id
          FROM transactions WHERE id = NEW.reversal_of_transaction_id;
          IF target_reversal_id IS NOT NULL THEN
            RAISE EXCEPTION 'Ledger integrity violation: a reversal transaction cannot itself be reversed';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER prevent_reversal_of_reversal
      BEFORE INSERT ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION prevent_reversal_of_reversal();
    `);

    // A reversal's entries must exactly mirror the original's (same accounts and
    // amounts, sides inverted, no extra/missing rows). Multiset comparison via
    // EXCEPT ALL in both directions, checked deferred at commit when all entries
    // exist. Entries are frozen post-commit, so this holds permanently.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_reversal_mirrors_original()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.reversal_of_transaction_id IS NOT NULL THEN
          IF EXISTS (
            SELECT account_id, amount_minor,
                   CASE type WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END
            FROM entries WHERE transaction_id = NEW.reversal_of_transaction_id
            EXCEPT ALL
            SELECT account_id, amount_minor, type
            FROM entries WHERE transaction_id = NEW.id
          ) OR EXISTS (
            SELECT account_id, amount_minor, type
            FROM entries WHERE transaction_id = NEW.id
            EXCEPT ALL
            SELECT account_id, amount_minor,
                   CASE type WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END
            FROM entries WHERE transaction_id = NEW.reversal_of_transaction_id
          ) THEN
            RAISE EXCEPTION 'Ledger integrity violation: reversal % does not mirror original %', NEW.id, NEW.reversal_of_transaction_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_reversal_mirrors_original
      AFTER INSERT OR UPDATE ON transactions
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_reversal_mirrors_original();
    `);

    // ---- 3. Non-empty invariants ----
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_external_payload_hash";`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_external_payload_hash"
      CHECK ("source_type" = 'SYSTEM' OR NULLIF(BTRIM("source_payload_hash"), '') IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_idempotency_key_nonempty"
      CHECK (NULLIF(BTRIM("idempotency_key"), '') IS NOT NULL);
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_source_type_nonempty"
      CHECK (NULLIF(BTRIM("source_type"), '') IS NOT NULL);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS enforce_reversal_mirrors_original ON transactions;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_reversal_mirrors_original;`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS prevent_reversal_of_reversal ON transactions;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_reversal_of_reversal;`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_source_type_nonempty";`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_idempotency_key_nonempty";`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "CHK_transactions_external_payload_hash";`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "CHK_transactions_external_payload_hash"
      CHECK ("source_type" = 'SYSTEM' OR "source_payload_hash" IS NOT NULL);
    `);

    // Restore enforce_reversed_has_reversal to the PostingLifecycle baseline.
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

    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_reversal_same_business";`,
    );
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_reversal_of"
        FOREIGN KEY ("reversal_of_transaction_id") REFERENCES "transactions" ("id") ON DELETE RESTRICT;
    `);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS enforce_no_committed_posting ON transactions;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_no_committed_posting;`,
    );
  }
}
