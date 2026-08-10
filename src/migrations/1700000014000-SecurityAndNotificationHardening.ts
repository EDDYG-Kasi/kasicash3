import { MigrationInterface, QueryRunner } from 'typeorm';

/** Shared rate-limit state and at-most-once alert-dispatch state. */
export class SecurityAndNotificationHardening1700000014000 implements MigrationInterface {
  name = 'SecurityAndNotificationHardening1700000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "anomaly_alerts"
      ADD COLUMN "dispatch_started_at" timestamptz,
      ADD COLUMN "last_error_code" varchar;
    `);
    await queryRunner.query(`
      UPDATE "anomaly_alerts"
      SET "last_error_code" = 'LEGACY_DELIVERY_FAILURE',
          "last_error" = NULL
      WHERE "last_error" IS NOT NULL;
    `);
    await queryRunner.query(
      `ALTER TABLE "anomaly_alerts" DROP CONSTRAINT "CHK_anomaly_alerts_status";`,
    );
    await queryRunner.query(`
      ALTER TABLE "anomaly_alerts"
      ADD CONSTRAINT "CHK_anomaly_alerts_status"
        CHECK ("status" IN ('SENDING','SENT','FAILED','DELIVERY_UNCERTAIN')),
      ADD CONSTRAINT "CHK_anomaly_alerts_no_raw_error" CHECK ("last_error" IS NULL),
      ADD CONSTRAINT "CHK_anomaly_alerts_error_code" CHECK (
        "last_error_code" IS NULL OR "last_error_code" ~ '^[A-Z0-9_]{1,64}$'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "security_rate_limits" (
        "key_hash"          varchar(64) NOT NULL,
        "count"             integer NOT NULL,
        "window_started_at" timestamptz NOT NULL,
        "expires_at"        timestamptz NOT NULL,
        CONSTRAINT "PK_security_rate_limits" PRIMARY KEY ("key_hash"),
        CONSTRAINT "CHK_security_rate_limits_hash" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "CHK_security_rate_limits_count" CHECK ("count" > 0)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_security_rate_limits_expires"
      ON "security_rate_limits" ("expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_security_rate_limits_expires";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "security_rate_limits";`);

    await queryRunner.query(
      `ALTER TABLE "anomaly_alerts" DROP CONSTRAINT IF EXISTS "CHK_anomaly_alerts_error_code";`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomaly_alerts" DROP CONSTRAINT IF EXISTS "CHK_anomaly_alerts_no_raw_error";`,
    );
    await queryRunner.query(
      `ALTER TABLE "anomaly_alerts" DROP CONSTRAINT "CHK_anomaly_alerts_status";`,
    );
    await queryRunner.query(`
      UPDATE "anomaly_alerts"
      SET "status" = 'FAILED'
      WHERE "status" = 'DELIVERY_UNCERTAIN';
    `);
    await queryRunner.query(`
      ALTER TABLE "anomaly_alerts"
      ADD CONSTRAINT "CHK_anomaly_alerts_status"
        CHECK ("status" IN ('SENDING','SENT','FAILED'));
    `);
    await queryRunner.query(`
      ALTER TABLE "anomaly_alerts"
      DROP COLUMN IF EXISTS "last_error_code",
      DROP COLUMN IF EXISTS "dispatch_started_at";
    `);
  }
}
