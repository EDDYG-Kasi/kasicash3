import { MigrationInterface, QueryRunner } from 'typeorm';

interface InstantColumn {
  table: string;
  column: string;
}

const INSTANT_COLUMNS: InstantColumn[] = [
  { table: 'businesses', column: 'created_at' },
  { table: 'accounts', column: 'created_at' },
  { table: 'transactions', column: 'occurred_at' },
  { table: 'transactions', column: 'received_at' },
  { table: 'transactions', column: 'posted_at' },
  { table: 'transactions', column: 'created_at' },
  { table: 'entries', column: 'created_at' },
  { table: 'inbound_messages', column: 'wa_timestamp' },
  { table: 'inbound_messages', column: 'received_at' },
  { table: 'inbound_messages', column: 'processed_at' },
  { table: 'inbound_messages', column: 'next_retry_at' },
  { table: 'transaction_proposals', column: 'wa_timestamp' },
  { table: 'transaction_proposals', column: 'received_at' },
  { table: 'transaction_proposals', column: 'created_at' },
  { table: 'transaction_proposals', column: 'updated_at' },
  { table: 'anomaly_alerts', column: 'sent_at' },
  { table: 'anomaly_alerts', column: 'created_at' },
  { table: 'anomaly_alerts', column: 'updated_at' },
  { table: 'auth_principals', column: 'created_at' },
  { table: 'auth_principals', column: 'updated_at' },
  { table: 'auth_sessions', column: 'expires_at' },
  { table: 'auth_sessions', column: 'revoked_at' },
  { table: 'auth_sessions', column: 'created_at' },
  { table: 'webhook_replay_events', column: 'expires_at' },
  { table: 'webhook_replay_events', column: 'first_seen_at' },
];

/**
 * Converts every stored instant to timestamptz. Existing values were written
 * and read as UTC by the application, so the conversion names UTC explicitly
 * instead of inheriting the migration connection's timezone.
 */
export class TimezoneAwareInstants1700000012000 implements MigrationInterface {
  name = 'TimezoneAwareInstants1700000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of INSTANT_COLUMNS) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ALTER COLUMN "${column}" TYPE timestamptz
        USING "${column}" AT TIME ZONE 'UTC';
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, column } of [...INSTANT_COLUMNS].reverse()) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ALTER COLUMN "${column}" TYPE timestamp
        USING "${column}" AT TIME ZONE 'UTC';
      `);
    }
  }
}
