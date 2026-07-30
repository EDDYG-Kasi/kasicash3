import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 hardening: durable transaction proposals.
 * Natural-language parsing may propose a transaction, but the ledger is only
 * written after a later explicit WhatsApp confirmation from the same business.
 */
export class TransactionProposals1700000007000 implements MigrationInterface {
  name = 'TransactionProposals1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "transaction_proposals" (
        "id"                         uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id"                uuid NOT NULL,
        "source_wa_message_id"       varchar NOT NULL,
        "source_payload_hash"        varchar NOT NULL,
        "kind"                       varchar NOT NULL,
        "amount_minor"               bigint NOT NULL,
        "currency"                   varchar(3) NOT NULL,
        "description"                text NOT NULL,
        "wa_timestamp"               timestamp NOT NULL,
        "received_at"                timestamp NOT NULL,
        "status"                     varchar NOT NULL DEFAULT 'PENDING',
        "confirmed_by_wa_message_id" varchar,
        "transaction_id"             uuid,
        "created_at"                 timestamp NOT NULL DEFAULT now(),
        "updated_at"                 timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_proposals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transaction_proposals_business_source"
          UNIQUE ("business_id", "source_wa_message_id"),
        CONSTRAINT "CHK_transaction_proposals_status"
          CHECK ("status" IN ('PENDING','CONFIRMED','CANCELLED')),
        CONSTRAINT "CHK_transaction_proposals_amount_positive"
          CHECK ("amount_minor" > 0),
        CONSTRAINT "CHK_transaction_proposals_currency"
          CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_transaction_proposals_confirmed_shape"
          CHECK (
            ("status" = 'CONFIRMED'
              AND "confirmed_by_wa_message_id" IS NOT NULL
              AND "transaction_id" IS NOT NULL)
            OR ("status" <> 'CONFIRMED'
              AND "confirmed_by_wa_message_id" IS NULL
              AND "transaction_id" IS NULL)
          ),
        CONSTRAINT "FK_transaction_proposals_business"
          FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transaction_proposals_transaction"
          FOREIGN KEY ("business_id", "transaction_id")
          REFERENCES "transactions"("business_id", "id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transaction_proposals_business_status_created"
      ON "transaction_proposals" ("business_id", "status", "created_at");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_transaction_proposals_confirm_message"
      ON "transaction_proposals" ("business_id", "confirmed_by_wa_message_id")
      WHERE "confirmed_by_wa_message_id" IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_transaction_proposals_one_pending_per_business"
      ON "transaction_proposals" ("business_id")
      WHERE "status" = 'PENDING';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_transaction_proposals_one_pending_per_business";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_transaction_proposals_confirm_message";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_transaction_proposals_business_status_created";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_proposals";`);
  }
}
