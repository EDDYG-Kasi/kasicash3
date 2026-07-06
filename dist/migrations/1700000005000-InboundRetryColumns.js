"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboundRetryColumns1700000005000 = void 0;
class InboundRetryColumns1700000005000 {
    name = 'InboundRetryColumns1700000005000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "inbound_messages" ADD COLUMN "attempts" int NOT NULL DEFAULT 0;`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" ADD COLUMN "next_retry_at" timestamp;`);
        await queryRunner.query(`UPDATE "inbound_messages" SET "next_retry_at" = now() WHERE "status" = 'FAILED' AND "next_retry_at" IS NULL;`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" DROP CONSTRAINT "CHK_inbound_messages_status";`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" ADD CONSTRAINT "CHK_inbound_messages_status" CHECK ("status" IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD'));`);
        await queryRunner.query(`CREATE INDEX "IDX_inbound_messages_retry" ON "inbound_messages" ("status", "next_retry_at");`);
        await queryRunner.query(`CREATE INDEX "IDX_inbound_messages_stale_received" ON "inbound_messages" ("status", "received_at");`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inbound_messages_stale_received";`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inbound_messages_retry";`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" DROP CONSTRAINT "CHK_inbound_messages_status";`);
        await queryRunner.query(`UPDATE "inbound_messages" SET "status" = 'RECEIVED' WHERE "status" = 'PROCESSING';`);
        await queryRunner.query(`UPDATE "inbound_messages" SET "status" = 'FAILED' WHERE "status" = 'DEAD';`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" ADD CONSTRAINT "CHK_inbound_messages_status" CHECK ("status" IN ('RECEIVED', 'PROCESSED', 'FAILED'));`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" DROP COLUMN IF EXISTS "next_retry_at";`);
        await queryRunner.query(`ALTER TABLE "inbound_messages" DROP COLUMN IF EXISTS "attempts";`);
    }
}
exports.InboundRetryColumns1700000005000 = InboundRetryColumns1700000005000;
//# sourceMappingURL=1700000005000-InboundRetryColumns.js.map