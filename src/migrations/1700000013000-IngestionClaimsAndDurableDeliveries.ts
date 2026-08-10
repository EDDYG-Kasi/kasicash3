import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds fenced ingestion claims, deterministic per-sender arrival order, exact
 * signed-delivery storage, and privacy-safe failure codes.
 */
export class IngestionClaimsAndDurableDeliveries1700000013000 implements MigrationInterface {
  name = 'IngestionClaimsAndDurableDeliveries1700000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inbound_messages"
      ADD COLUMN "ingest_sequence" bigserial;
    `);
    await queryRunner.query(`
      ALTER TABLE "inbound_messages"
      ADD COLUMN "claim_token" uuid,
      ADD COLUMN "lease_expires_at" timestamptz,
      ADD COLUMN "error_code" varchar;
    `);
    await queryRunner.query(`
      UPDATE "inbound_messages"
      SET "claim_token" = gen_random_uuid(),
          "lease_expires_at" = COALESCE("next_retry_at", now())
      WHERE "status" = 'PROCESSING';
    `);
    await queryRunner.query(`
      UPDATE "inbound_messages"
      SET "error_code" = 'LEGACY_PROCESSING_FAILURE',
          "error" = NULL
      WHERE "error" IS NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "inbound_messages"
      ADD CONSTRAINT "CHK_inbound_messages_claim_shape" CHECK (
        (
          "status" = 'PROCESSING'
          AND "claim_token" IS NOT NULL
          AND "lease_expires_at" IS NOT NULL
        ) OR (
          "status" <> 'PROCESSING'
          AND "claim_token" IS NULL
          AND "lease_expires_at" IS NULL
        )
      ),
      ADD CONSTRAINT "CHK_inbound_messages_no_raw_error" CHECK ("error" IS NULL),
      ADD CONSTRAINT "CHK_inbound_messages_error_code" CHECK (
        "error_code" IS NULL OR "error_code" ~ '^[A-Z0-9_]{1,64}$'
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_inbound_messages_ingest_sequence"
      ON "inbound_messages" ("ingest_sequence");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_inbound_messages_sender_order"
      ON "inbound_messages" ("wa_from", "ingest_sequence", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_inbound_messages_expired_lease"
      ON "inbound_messages" ("status", "lease_expires_at")
      WHERE "status" = 'PROCESSING';
    `);

    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "payload_hash"   varchar(64) NOT NULL,
        "signature_hash" varchar(64) NOT NULL,
        "raw_body"       bytea NOT NULL,
        "status"         varchar NOT NULL DEFAULT 'RECEIVED',
        "error_code"     varchar,
        "message_count"  integer NOT NULL DEFAULT 0,
        "received_at"    timestamptz NOT NULL DEFAULT now(),
        "processed_at"   timestamptz,
        CONSTRAINT "PK_webhook_deliveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_deliveries_payload_hash" UNIQUE ("payload_hash"),
        CONSTRAINT "CHK_webhook_deliveries_hash" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_webhook_deliveries_signature_hash" CHECK ("signature_hash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_webhook_deliveries_status" CHECK ("status" IN ('RECEIVED','ACCEPTED','QUARANTINED')),
        CONSTRAINT "CHK_webhook_deliveries_error_code" CHECK (
          "error_code" IS NULL OR "error_code" ~ '^[A-Z0-9_]{1,64}$'
        ),
        CONSTRAINT "CHK_webhook_deliveries_message_count" CHECK ("message_count" >= 0)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_deliveries_status_received"
      ON "webhook_deliveries" ("status", "received_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_deliveries_status_received";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries";`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inbound_messages_expired_lease";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inbound_messages_sender_order";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_inbound_messages_ingest_sequence";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP CONSTRAINT IF EXISTS "CHK_inbound_messages_error_code";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP CONSTRAINT IF EXISTS "CHK_inbound_messages_no_raw_error";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP CONSTRAINT IF EXISTS "CHK_inbound_messages_claim_shape";`,
    );
    await queryRunner.query(`
      UPDATE "inbound_messages"
      SET "next_retry_at" = COALESCE("next_retry_at", "lease_expires_at")
      WHERE "status" = 'PROCESSING';
    `);
    await queryRunner.query(`
      ALTER TABLE "inbound_messages"
      DROP COLUMN IF EXISTS "error_code",
      DROP COLUMN IF EXISTS "lease_expires_at",
      DROP COLUMN IF EXISTS "claim_token",
      DROP COLUMN IF EXISTS "ingest_sequence";
    `);
  }
}
