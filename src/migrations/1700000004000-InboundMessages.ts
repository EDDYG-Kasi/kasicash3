import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2: WhatsApp ingestion store + business onboarding key.
 * Raw messages are persisted before interpretation; wa_message_id is the
 * idempotency anchor for webhook redelivery. businesses.wa_phone links a
 * WhatsApp sender to their auto-created business.
 */
export class InboundMessages1700000004000 implements MigrationInterface {
  name = 'InboundMessages1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inbound_messages" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "wa_message_id" varchar NOT NULL,
        "wa_from"       varchar NOT NULL,
        "business_id"   uuid,
        "payload"       jsonb NOT NULL,
        "payload_hash"  varchar NOT NULL,
        "message_type"  varchar NOT NULL,
        "text_body"     text,
        "wa_timestamp"  timestamp NOT NULL,
        "received_at"   timestamp NOT NULL DEFAULT now(),
        "status"        varchar NOT NULL DEFAULT 'RECEIVED',
        "processed_at"  timestamp,
        "error"         text,
        CONSTRAINT "PK_inbound_messages" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inbound_messages_wa_message_id" UNIQUE ("wa_message_id"),
        CONSTRAINT "CHK_inbound_messages_status" CHECK ("status" IN ('RECEIVED','PROCESSED','FAILED')),
        CONSTRAINT "FK_inbound_messages_business"
          FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_messages_business_id" ON "inbound_messages" ("business_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_messages_status" ON "inbound_messages" ("status");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_messages_wa_from" ON "inbound_messages" ("wa_from");`,
    );

    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "wa_phone" varchar;`,
    );
    await queryRunner.query(`
      ALTER TABLE "businesses"
      ADD CONSTRAINT "UQ_businesses_wa_phone" UNIQUE ("wa_phone");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP CONSTRAINT IF EXISTS "UQ_businesses_wa_phone";`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN IF EXISTS "wa_phone";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inbound_messages";`);
  }
}
