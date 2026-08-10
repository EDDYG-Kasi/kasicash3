import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Upgrade preflight for the stricter round-two constraints. Only
 * semantics-preserving canonicalization is automatic. Ambiguous provenance or
 * currency remains untouched and is reported by bounded category/count.
 */
export class LegacyIntegrityPreflight1700000014500 implements MigrationInterface {
  name = 'LegacyIntegrityPreflight1700000014500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "legacy_integrity_remediations" (
        "table_name"  varchar NOT NULL,
        "row_id"      uuid NOT NULL,
        "column_name" varchar NOT NULL,
        "old_value"   text,
        "new_value"   text,
        CONSTRAINT "PK_legacy_integrity_remediations"
          PRIMARY KEY ("table_name", "row_id", "column_name")
      );
    `);
    await queryRunner.query(`
      CREATE TABLE "legacy_integrity_preflight" (
        "category"   varchar NOT NULL,
        "row_count"  bigint NOT NULL,
        "checked_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legacy_integrity_preflight" PRIMARY KEY ("category"),
        CONSTRAINT "CHK_legacy_integrity_preflight_count" CHECK ("row_count" >= 0)
      );
    `);

    await queryRunner.query(`
      INSERT INTO "legacy_integrity_remediations"
        ("table_name", "row_id", "column_name", "old_value", "new_value")
      SELECT 'transactions', id, 'source_type', source_type, upper(btrim(source_type))
      FROM transactions
      WHERE source_type IS DISTINCT FROM upper(btrim(source_type))
        AND upper(btrim(source_type)) IN ('SYSTEM','WHATSAPP','API','WEB');
    `);
    await queryRunner.query(`
      INSERT INTO "legacy_integrity_remediations"
        ("table_name", "row_id", "column_name", "old_value", "new_value")
      SELECT 'transactions', id, 'source_payload_hash', source_payload_hash,
             CASE
               WHEN upper(btrim(source_type)) = 'SYSTEM'
                    AND btrim(source_payload_hash) = '' THEN NULL
               ELSE lower(btrim(source_payload_hash))
             END
      FROM transactions
      WHERE source_payload_hash IS NOT NULL
        AND (
          (upper(btrim(source_type)) = 'SYSTEM' AND btrim(source_payload_hash) = '')
          OR (
            upper(btrim(source_type)) <> 'SYSTEM'
            AND btrim(source_payload_hash) ~* '^[0-9a-f]{64}$'
            AND source_payload_hash IS DISTINCT FROM lower(btrim(source_payload_hash))
          )
        );
    `);
    await queryRunner.query(
      `ALTER TABLE transactions DISABLE TRIGGER prevent_transaction_update_delete;`,
    );
    try {
      await queryRunner.query(`
        UPDATE transactions AS target
        SET source_type = remediation.new_value
        FROM legacy_integrity_remediations AS remediation
        WHERE remediation.table_name = 'transactions'
          AND remediation.column_name = 'source_type'
          AND remediation.row_id = target.id;
      `);
      await queryRunner.query(`
        UPDATE transactions AS target
        SET source_payload_hash = remediation.new_value
        FROM legacy_integrity_remediations AS remediation
        WHERE remediation.table_name = 'transactions'
          AND remediation.column_name = 'source_payload_hash'
          AND remediation.row_id = target.id;
      `);
    } finally {
      await queryRunner.query(
        `ALTER TABLE transactions ENABLE TRIGGER prevent_transaction_update_delete;`,
      );
    }

    await queryRunner.query(`
      INSERT INTO "legacy_integrity_remediations"
        ("table_name", "row_id", "column_name", "old_value", "new_value")
      SELECT 'transaction_proposals', id, 'source_payload_hash', source_payload_hash,
             lower(btrim(source_payload_hash))
      FROM transaction_proposals
      WHERE btrim(source_payload_hash) ~* '^[0-9a-f]{64}$'
        AND source_payload_hash IS DISTINCT FROM lower(btrim(source_payload_hash));
    `);
    await queryRunner.query(`
      INSERT INTO "legacy_integrity_remediations"
        ("table_name", "row_id", "column_name", "old_value", "new_value")
      SELECT 'transaction_proposals', id, 'currency', currency, upper(btrim(currency))
      FROM transaction_proposals
      WHERE currency IS DISTINCT FROM upper(btrim(currency))
        AND upper(btrim(currency)) IN ('ZAR','USD','JPY','BHD');
    `);
    await queryRunner.query(`
      INSERT INTO "legacy_integrity_remediations"
        ("table_name", "row_id", "column_name", "old_value", "new_value")
      SELECT 'transaction_proposals', id, 'kind', kind, upper(btrim(kind))
      FROM transaction_proposals
      WHERE kind IS DISTINCT FROM upper(btrim(kind))
        AND upper(btrim(kind)) IN ('SALE','EXPENSE');
    `);
    await queryRunner.query(`
      UPDATE transaction_proposals AS target
      SET source_payload_hash = remediation.new_value
      FROM legacy_integrity_remediations AS remediation
      WHERE remediation.table_name = 'transaction_proposals'
        AND remediation.column_name = 'source_payload_hash'
        AND remediation.row_id = target.id;
    `);
    await queryRunner.query(`
      UPDATE transaction_proposals AS target
      SET currency = remediation.new_value
      FROM legacy_integrity_remediations AS remediation
      WHERE remediation.table_name = 'transaction_proposals'
        AND remediation.column_name = 'currency'
        AND remediation.row_id = target.id;
    `);
    await queryRunner.query(`
      UPDATE transaction_proposals AS target
      SET kind = remediation.new_value
      FROM legacy_integrity_remediations AS remediation
      WHERE remediation.table_name = 'transaction_proposals'
        AND remediation.column_name = 'kind'
        AND remediation.row_id = target.id;
    `);

    await this.recordCurrencyCanonicalization(
      queryRunner,
      'auth_principals',
      'default_currency',
    );
    await this.recordCurrencyCanonicalization(
      queryRunner,
      'anomaly_alerts',
      'currency',
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION refresh_legacy_integrity_preflight()
      RETURNS bigint AS $$
      DECLARE total_issues bigint;
      BEGIN
        DELETE FROM legacy_integrity_preflight;
        INSERT INTO legacy_integrity_preflight (category, row_count)
        VALUES
          ('TRANSACTION_INVALID_SOURCE_TYPE',
            (SELECT count(*) FROM transactions
             WHERE source_type NOT IN ('SYSTEM','WHATSAPP','API','WEB'))),
          ('TRANSACTION_INVALID_SOURCE_HASH',
            (SELECT count(*) FROM transactions
             WHERE NOT (
               (source_type = 'SYSTEM' AND source_payload_hash IS NULL)
               OR (source_type <> 'SYSTEM' AND source_payload_hash ~ '^[0-9a-f]{64}$')
             ))),
          ('TRANSACTION_WHATSAPP_MISSING_SOURCE_ID',
            (SELECT count(*) FROM transactions
             WHERE source_type = 'WHATSAPP'
               AND (source_message_id IS NULL OR btrim(source_message_id) = ''))),
          ('TRANSACTION_UNSUPPORTED_CURRENCY',
            (SELECT count(*) FROM transactions
             WHERE currency NOT IN ('ZAR','USD','JPY','BHD'))),
          ('PROPOSAL_INVALID_SOURCE_HASH',
            (SELECT count(*) FROM transaction_proposals
             WHERE source_payload_hash !~ '^[0-9a-f]{64}$')),
          ('PROPOSAL_INVALID_KIND',
            (SELECT count(*) FROM transaction_proposals
             WHERE kind NOT IN ('SALE','EXPENSE'))),
          ('PROPOSAL_UNSUPPORTED_CURRENCY',
            (SELECT count(*) FROM transaction_proposals
             WHERE currency NOT IN ('ZAR','USD','JPY','BHD'))),
          ('CONFIRMED_PROPOSAL_TRANSACTION_MISMATCH',
            (SELECT count(*)
             FROM transaction_proposals proposal
             WHERE proposal.status = 'CONFIRMED'
               AND NOT EXISTS (
                 SELECT 1
                 FROM transactions transaction
                 WHERE transaction.id = proposal.transaction_id
                   AND transaction.business_id = proposal.business_id
                   AND transaction.status IN ('POSTED','REVERSED')
                   AND transaction.currency = proposal.currency
                   AND transaction.description = proposal.description
                   AND transaction.idempotency_key = 'proposal:' || proposal.id::text
                   AND transaction.source_type = 'WHATSAPP'
                   AND transaction.source_message_id = proposal.source_wa_message_id
                   AND transaction.source_payload_hash = proposal.source_payload_hash
                   AND transaction.occurred_at = proposal.wa_timestamp
                   AND transaction.received_at = proposal.received_at
                   AND (SELECT count(*) FROM entries entry WHERE entry.transaction_id = transaction.id) = 2
                   AND (
                     (proposal.kind = 'SALE'
                       AND EXISTS (
                         SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                         WHERE entry.transaction_id = transaction.id AND entry.type = 'DEBIT'
                           AND entry.amount_minor = proposal.amount_minor AND account.business_id = proposal.business_id
                           AND account.code = '100'
                       )
                       AND EXISTS (
                         SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                         WHERE entry.transaction_id = transaction.id AND entry.type = 'CREDIT'
                           AND entry.amount_minor = proposal.amount_minor AND account.business_id = proposal.business_id
                           AND account.code = '400'
                       ))
                     OR
                     (proposal.kind = 'EXPENSE'
                       AND EXISTS (
                         SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                         WHERE entry.transaction_id = transaction.id AND entry.type = 'DEBIT'
                           AND entry.amount_minor = proposal.amount_minor AND account.business_id = proposal.business_id
                           AND account.code = '500'
                       )
                       AND EXISTS (
                         SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                         WHERE entry.transaction_id = transaction.id AND entry.type = 'CREDIT'
                           AND entry.amount_minor = proposal.amount_minor AND account.business_id = proposal.business_id
                           AND account.code = '100'
                       ))
                   )
               ))),
          ('PRINCIPAL_UNSUPPORTED_CURRENCY',
            (SELECT count(*) FROM auth_principals
             WHERE default_currency NOT IN ('ZAR','USD','JPY','BHD'))),
          ('ALERT_UNSUPPORTED_CURRENCY',
            (SELECT count(*) FROM anomaly_alerts
             WHERE currency NOT IN ('ZAR','USD','JPY','BHD')));

        SELECT COALESCE(sum(row_count), 0)
        INTO total_issues
        FROM legacy_integrity_preflight;
        RETURN total_issues;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`SELECT refresh_legacy_integrity_preflight();`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.restoreColumn(queryRunner, 'anomaly_alerts', 'currency', false);
    await this.restoreColumn(
      queryRunner,
      'auth_principals',
      'default_currency',
      false,
    );
    await this.restoreColumn(
      queryRunner,
      'transaction_proposals',
      'kind',
      false,
    );
    await this.restoreColumn(
      queryRunner,
      'transaction_proposals',
      'currency',
      false,
    );
    await this.restoreColumn(
      queryRunner,
      'transaction_proposals',
      'source_payload_hash',
      false,
    );
    await this.restoreColumn(
      queryRunner,
      'transactions',
      'source_payload_hash',
      true,
    );
    await this.restoreColumn(queryRunner, 'transactions', 'source_type', true);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS refresh_legacy_integrity_preflight();`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS legacy_integrity_preflight;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS legacy_integrity_remediations;`,
    );
  }

  private async recordCurrencyCanonicalization(
    queryRunner: QueryRunner,
    table: 'auth_principals' | 'anomaly_alerts',
    column: 'default_currency' | 'currency',
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO legacy_integrity_remediations
        (table_name, row_id, column_name, old_value, new_value)
      SELECT '${table}', id, '${column}', ${column}, upper(btrim(${column}))
      FROM ${table}
      WHERE ${column} IS DISTINCT FROM upper(btrim(${column}))
        AND upper(btrim(${column})) IN ('ZAR','USD','JPY','BHD');
    `);
    await queryRunner.query(`
      UPDATE ${table} AS target
      SET ${column} = remediation.new_value
      FROM legacy_integrity_remediations AS remediation
      WHERE remediation.table_name = '${table}'
        AND remediation.column_name = '${column}'
        AND remediation.row_id = target.id;
    `);
  }

  private async restoreColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    guardedTransactionTable: boolean,
  ): Promise<void> {
    if (guardedTransactionTable) {
      await queryRunner.query(
        `ALTER TABLE transactions DISABLE TRIGGER prevent_transaction_update_delete;`,
      );
    }
    try {
      await queryRunner.query(`
        UPDATE ${table} AS target
        SET ${column} = remediation.old_value
        FROM legacy_integrity_remediations AS remediation
        WHERE remediation.table_name = '${table}'
          AND remediation.column_name = '${column}'
          AND remediation.row_id = target.id;
      `);
    } finally {
      if (guardedTransactionTable) {
        await queryRunner.query(
          `ALTER TABLE transactions ENABLE TRIGGER prevent_transaction_update_delete;`,
        );
      }
    }
  }
}
