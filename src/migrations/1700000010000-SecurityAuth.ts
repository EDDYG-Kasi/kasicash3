import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityAuth1700000010000 implements MigrationInterface {
  name = 'SecurityAuth1700000010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE auth_principals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id uuid NOT NULL,
        email varchar NOT NULL,
        email_normalized varchar NOT NULL,
        password_hash text NOT NULL,
        status varchar NOT NULL DEFAULT 'ACTIVE',
        default_currency varchar(3) NOT NULL DEFAULT 'ZAR',
        timezone varchar NOT NULL DEFAULT 'Africa/Johannesburg',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT UQ_auth_principals_email_normalized UNIQUE (email_normalized),
        CONSTRAINT FK_auth_principals_business FOREIGN KEY (business_id)
          REFERENCES businesses(id)
          ON DELETE RESTRICT,
        CONSTRAINT CK_auth_principals_status CHECK (status IN ('ACTIVE', 'DISABLED')),
        CONSTRAINT CK_auth_principals_email_normalized CHECK (email_normalized = lower(email_normalized)),
        CONSTRAINT CK_auth_principals_currency CHECK (default_currency ~ '^[A-Z]{3}$')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_auth_principals_business
      ON auth_principals (business_id)
    `);

    await queryRunner.query(`
      CREATE TABLE auth_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        principal_id uuid NOT NULL,
        token_hash varchar(64) NOT NULL,
        expires_at timestamp NOT NULL,
        revoked_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT UQ_auth_sessions_token_hash UNIQUE (token_hash),
        CONSTRAINT FK_auth_sessions_principal FOREIGN KEY (principal_id)
          REFERENCES auth_principals(id)
          ON DELETE CASCADE,
        CONSTRAINT CK_auth_sessions_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_auth_sessions_principal_active
      ON auth_sessions (principal_id, expires_at)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE webhook_replay_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        payload_hash varchar(64) NOT NULL,
        signature_hash varchar(64) NOT NULL,
        expires_at timestamp NOT NULL,
        first_seen_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT UQ_webhook_replay_events_payload_hash UNIQUE (payload_hash),
        CONSTRAINT CK_webhook_replay_events_payload_hash CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT CK_webhook_replay_events_signature_hash CHECK (signature_hash ~ '^[0-9a-f]{64}$')
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IDX_webhook_replay_events_expires
      ON webhook_replay_events (expires_at)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_webhook_replay_events_expires',
    );
    await queryRunner.query('DROP TABLE IF EXISTS webhook_replay_events');
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_auth_sessions_principal_active',
    );
    await queryRunner.query('DROP TABLE IF EXISTS auth_sessions');
    await queryRunner.query(
      'DROP INDEX IF EXISTS IDX_auth_principals_business',
    );
    await queryRunner.query('DROP TABLE IF EXISTS auth_principals');
  }
}
