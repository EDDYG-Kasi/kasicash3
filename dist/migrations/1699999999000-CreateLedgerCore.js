"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLedgerCore1699999999000 = void 0;
class CreateLedgerCore1699999999000 {
    name = 'CreateLedgerCore1699999999000';
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
        await queryRunner.query(`
      CREATE TABLE "businesses" (
        "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"       varchar NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_businesses" PRIMARY KEY ("id")
      );
    `);
        await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar NOT NULL,
        "code"        varchar NOT NULL,
        "type"        varchar NOT NULL,
        "business_id" uuid NOT NULL,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_accounts_business_code" UNIQUE ("business_id", "code"),
        CONSTRAINT "CHK_accounts_type"
          CHECK ("type" IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
        CONSTRAINT "FK_accounts_business"
          FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT
      );
    `);
        await queryRunner.query(`CREATE INDEX "IDX_accounts_business_id" ON "accounts" ("business_id");`);
        await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id"                         uuid NOT NULL DEFAULT gen_random_uuid(),
        "description"                varchar NOT NULL,
        "currency"                   varchar(3) NOT NULL,
        "idempotency_key"            varchar NOT NULL,
        "source_type"                varchar NOT NULL,
        "source_message_id"          varchar,
        "source_payload_hash"        varchar,
        "occurred_at"                timestamp NOT NULL,
        "received_at"                timestamp NOT NULL,
        "posted_at"                  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status"                     varchar NOT NULL DEFAULT 'POSTED',
        "reversal_of_transaction_id" uuid,
        "business_id"                uuid NOT NULL,
        "created_at"                 timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_business_idempotency" UNIQUE ("business_id", "idempotency_key"),
        CONSTRAINT "CHK_transactions_status" CHECK ("status" IN ('POSTED', 'REVERSED')),
        CONSTRAINT "FK_transactions_business"
          FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transactions_reversal_of"
          FOREIGN KEY ("reversal_of_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT
      );
    `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_business_id" ON "transactions" ("business_id");`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_idempotency_key" ON "transactions" ("idempotency_key");`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_source_message_id" ON "transactions" ("source_message_id");`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_reversal_of" ON "transactions" ("reversal_of_transaction_id");`);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_transactions_one_reversal_per_original"
        ON "transactions" ("reversal_of_transaction_id")
        WHERE "reversal_of_transaction_id" IS NOT NULL;
    `);
        await queryRunner.query(`
      CREATE TABLE "entries" (
        "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
        "amount_minor"   bigint NOT NULL,
        "type"           varchar NOT NULL,
        "transaction_id" uuid NOT NULL,
        "account_id"     uuid NOT NULL,
        "created_at"     timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entries" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_entries_amount_positive" CHECK ("amount_minor" > 0),
        CONSTRAINT "CHK_entries_type" CHECK ("type" IN ('DEBIT', 'CREDIT')),
        CONSTRAINT "FK_entries_transaction"
          FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_entries_account"
          FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT
      );
    `);
        await queryRunner.query(`CREATE INDEX "IDX_entries_transaction_id" ON "entries" ("transaction_id");`);
        await queryRunner.query(`CREATE INDEX "IDX_entries_account_id" ON "entries" ("account_id");`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "entries";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transactions";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "accounts";`);
        await queryRunner.query(`DROP TABLE IF EXISTS "businesses";`);
    }
}
exports.CreateLedgerCore1699999999000 = CreateLedgerCore1699999999000;
//# sourceMappingURL=1699999999000-CreateLedgerCore.js.map