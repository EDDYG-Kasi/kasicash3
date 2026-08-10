import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 alert delivery metadata. This table stores notification idempotency
 * and recovery state only; it is not a financial record and does not cache
 * ledger-derived figures as source of truth.
 */
export class AnomalyAlerts1700000009000 implements MigrationInterface {
  name = 'AnomalyAlerts1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "anomaly_alerts" (
        "id"                 uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id"        uuid NOT NULL,
        "anomaly_key"        varchar NOT NULL,
        "anomaly_type"       varchar NOT NULL,
        "currency"           varchar(3) NOT NULL,
        "timezone"           varchar NOT NULL,
        "period_start_local" varchar NOT NULL,
        "period_end_local"   varchar NOT NULL,
        "payload"            jsonb NOT NULL,
        "status"             varchar NOT NULL DEFAULT 'SENDING',
        "attempts"           integer NOT NULL DEFAULT 0,
        "last_error"         text,
        "sent_at"            timestamp,
        "created_at"         timestamp NOT NULL DEFAULT now(),
        "updated_at"         timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_anomaly_alerts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_anomaly_alerts_business_key" UNIQUE ("business_id", "anomaly_key"),
        CONSTRAINT "CHK_anomaly_alerts_status" CHECK ("status" IN ('SENDING','SENT','FAILED')),
        CONSTRAINT "CHK_anomaly_alerts_attempts_nonnegative" CHECK ("attempts" >= 0),
        CONSTRAINT "CHK_anomaly_alerts_sent_shape" CHECK (
          ("status" = 'SENT' AND "sent_at" IS NOT NULL)
          OR ("status" <> 'SENT')
        ),
        CONSTRAINT "FK_anomaly_alerts_business"
          FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_anomaly_alerts_business_status_updated"
      ON "anomaly_alerts" ("business_id", "status", "updated_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_anomaly_alerts_business_status_updated";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "anomaly_alerts";`);
  }
}
