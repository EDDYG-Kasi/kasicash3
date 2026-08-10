import { MigrationInterface, QueryRunner } from 'typeorm';

/** Closes production-integrity gaps found by the full-system review. */
export class RoundTwoIntegrityHardening1700000015000 implements MigrationInterface {
  name = 'RoundTwoIntegrityHardening1700000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_referenced_account_reclassification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.business_id IS DISTINCT FROM OLD.business_id
           OR NEW.code IS DISTINCT FROM OLD.code
           OR NEW.type IS DISTINCT FROM OLD.type THEN
          RAISE EXCEPTION 'Ledger integrity violation: account business_id, code, and type are immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TABLE "supported_currencies" (
        "code"                         varchar(3) NOT NULL,
        "minor_unit_scale"             smallint NOT NULL,
        "large_expense_floor_minor"    bigint NOT NULL,
        "sales_baseline_floor_minor"   bigint NOT NULL,
        "sales_spike_delta_minor"      bigint NOT NULL,
        CONSTRAINT "PK_supported_currencies" PRIMARY KEY ("code"),
        CONSTRAINT "CHK_supported_currencies_code" CHECK ("code" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_supported_currencies_scale" CHECK ("minor_unit_scale" BETWEEN 0 AND 3),
        CONSTRAINT "CHK_supported_currencies_thresholds" CHECK (
          "large_expense_floor_minor" > 0
          AND "sales_baseline_floor_minor" > 0
          AND "sales_spike_delta_minor" > 0
        )
      );
    `);
    await queryRunner.query(`
      INSERT INTO "supported_currencies" (
        "code", "minor_unit_scale", "large_expense_floor_minor",
        "sales_baseline_floor_minor", "sales_spike_delta_minor"
      ) VALUES
        ('ZAR', 2, 50000, 100000, 20000),
        ('USD', 2, 50000, 100000, 20000),
        ('JPY', 0, 500, 1000, 200),
        ('BHD', 3, 500000, 1000000, 200000);
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_supported_currency"
        FOREIGN KEY ("currency") REFERENCES "supported_currencies"("code") ON DELETE RESTRICT,
      ADD CONSTRAINT "CHK_transactions_source_type_v2"
        CHECK ("source_type" IN ('SYSTEM','WHATSAPP','API','WEB')),
      ADD CONSTRAINT "CHK_transactions_source_hash_v2" CHECK (
        ("source_type" = 'SYSTEM' AND "source_payload_hash" IS NULL)
        OR ("source_type" <> 'SYSTEM' AND "source_payload_hash" ~ '^[0-9a-f]{64}$')
      ),
      ADD CONSTRAINT "CHK_transactions_whatsapp_source_id_v2" CHECK (
        "source_type" <> 'WHATSAPP'
        OR ("source_message_id" IS NOT NULL AND btrim("source_message_id") <> '')
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_proposals"
      ADD CONSTRAINT "FK_transaction_proposals_supported_currency"
        FOREIGN KEY ("currency") REFERENCES "supported_currencies"("code") ON DELETE RESTRICT,
      ADD CONSTRAINT "CHK_transaction_proposals_source_hash_v2"
        CHECK ("source_payload_hash" ~ '^[0-9a-f]{64}$');
    `);
    await queryRunner.query(`
      ALTER TABLE "auth_principals"
      ADD CONSTRAINT "FK_auth_principals_supported_currency"
        FOREIGN KEY ("default_currency") REFERENCES "supported_currencies"("code") ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE "anomaly_alerts"
      ADD CONSTRAINT "FK_anomaly_alerts_supported_currency"
        FOREIGN KEY ("currency") REFERENCES "supported_currencies"("code") ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "anomaly_alerts" DROP CONSTRAINT IF EXISTS "FK_anomaly_alerts_supported_currency";`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_principals" DROP CONSTRAINT IF EXISTS "FK_auth_principals_supported_currency";`,
    );
    await queryRunner.query(`
      ALTER TABLE "transaction_proposals"
      DROP CONSTRAINT IF EXISTS "CHK_transaction_proposals_source_hash_v2",
      DROP CONSTRAINT IF EXISTS "FK_transaction_proposals_supported_currency";
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP CONSTRAINT IF EXISTS "CHK_transactions_whatsapp_source_id_v2",
      DROP CONSTRAINT IF EXISTS "CHK_transactions_source_hash_v2",
      DROP CONSTRAINT IF EXISTS "CHK_transactions_source_type_v2",
      DROP CONSTRAINT IF EXISTS "FK_transactions_supported_currency";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "supported_currencies";`);

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
  }
}
