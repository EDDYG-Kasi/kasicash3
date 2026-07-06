import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 completion: durable retry + dead-letter support for inbound messages.
 *  - attempts: processing attempt counter (drives backoff and DLQ cutoff).
 *  - next_retry_at: when a FAILED message becomes eligible for retry (backoff).
 *  - status gains 'DEAD' (dead-letter queue) for messages that exhausted retries.
 * The (status, next_retry_at) index serves the recovery worker's poll query.
 */
export class InboundRetryColumns1700000005000 implements MigrationInterface {
  name = 'InboundRetryColumns1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" ADD COLUMN "attempts" int NOT NULL DEFAULT 0;`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" ADD COLUMN "next_retry_at" timestamp;`,
    );
    // Backfill any pre-existing FAILED rows so they become immediately retryable
    // rather than stranded (the recovery poll needs next_retry_at set).
    await queryRunner.query(
      `UPDATE "inbound_messages" SET "next_retry_at" = now() WHERE "status" = 'FAILED' AND "next_retry_at" IS NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP CONSTRAINT "CHK_inbound_messages_status";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" ADD CONSTRAINT "CHK_inbound_messages_status" CHECK ("status" IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD'));`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_messages_retry" ON "inbound_messages" ("status", "next_retry_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inbound_messages_stale_received" ON "inbound_messages" ("status", "received_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inbound_messages_stale_received";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inbound_messages_retry";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP CONSTRAINT "CHK_inbound_messages_status";`,
    );
    // Collapse states absent from the narrower CHECK: in-flight PROCESSING back to
    // RECEIVED (unprocessed), DEAD back to FAILED.
    await queryRunner.query(
      `UPDATE "inbound_messages" SET "status" = 'RECEIVED' WHERE "status" = 'PROCESSING';`,
    );
    await queryRunner.query(
      `UPDATE "inbound_messages" SET "status" = 'FAILED' WHERE "status" = 'DEAD';`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" ADD CONSTRAINT "CHK_inbound_messages_status" CHECK ("status" IN ('RECEIVED', 'PROCESSED', 'FAILED'));`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP COLUMN IF EXISTS "next_retry_at";`,
    );
    await queryRunner.query(
      `ALTER TABLE "inbound_messages" DROP COLUMN IF EXISTS "attempts";`,
    );
  }
}
