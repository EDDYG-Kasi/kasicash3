import { MigrationInterface, QueryRunner } from 'typeorm';

/** Freezes prompt-visible facts and binds confirmation to the exact ledger post. */
export class ProposalConfirmationIntegrity1700000016000 implements MigrationInterface {
  name = 'ProposalConfirmationIntegrity1700000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION compute_transaction_proposal_digest(
        business_value uuid,
        source_message_value varchar,
        source_hash_value varchar,
        kind_value varchar,
        amount_value bigint,
        currency_value varchar,
        description_value text,
        wa_timestamp_value timestamptz,
        received_at_value timestamptz
      ) RETURNS varchar AS $$
        SELECT encode(
          digest(
            concat_ws('.',
              encode(convert_to(business_value::text, 'UTF8'), 'base64'),
              encode(convert_to(source_message_value, 'UTF8'), 'base64'),
              encode(convert_to(source_hash_value, 'UTF8'), 'base64'),
              encode(convert_to(kind_value, 'UTF8'), 'base64'),
              encode(convert_to(amount_value::text, 'UTF8'), 'base64'),
              encode(convert_to(currency_value, 'UTF8'), 'base64'),
              encode(convert_to(description_value, 'UTF8'), 'base64'),
              encode(convert_to(to_char(wa_timestamp_value AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'UTF8'), 'base64'),
              encode(convert_to(to_char(received_at_value AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'UTF8'), 'base64')
            ),
            'sha256'
          ),
          'hex'
        )::varchar;
      $$ LANGUAGE sql IMMUTABLE STRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE transaction_proposals
      ADD COLUMN proposal_digest varchar(64);
    `);
    await queryRunner.query(`
      UPDATE transaction_proposals
      SET proposal_digest = compute_transaction_proposal_digest(
        business_id,
        source_wa_message_id,
        source_payload_hash,
        kind,
        amount_minor,
        currency,
        description,
        wa_timestamp,
        received_at
      );
    `);
    await queryRunner.query(`
      ALTER TABLE transaction_proposals
      ALTER COLUMN proposal_digest SET NOT NULL,
      ADD CONSTRAINT "CHK_transaction_proposals_kind_v2"
        CHECK (kind IN ('SALE','EXPENSE')),
      ADD CONSTRAINT "CHK_transaction_proposals_digest_v2"
        CHECK (proposal_digest ~ '^[0-9a-f]{64}$'),
      ADD CONSTRAINT "UQ_transaction_proposals_transaction_id_v2"
        UNIQUE (transaction_id);
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_transaction_proposal_facts()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          NEW.proposal_digest := compute_transaction_proposal_digest(
            NEW.business_id,
            NEW.source_wa_message_id,
            NEW.source_payload_hash,
            NEW.kind,
            NEW.amount_minor,
            NEW.currency,
            NEW.description,
            NEW.wa_timestamp,
            NEW.received_at
          );
          RETURN NEW;
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.business_id IS DISTINCT FROM OLD.business_id
           OR NEW.source_wa_message_id IS DISTINCT FROM OLD.source_wa_message_id
           OR NEW.source_payload_hash IS DISTINCT FROM OLD.source_payload_hash
           OR NEW.kind IS DISTINCT FROM OLD.kind
           OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.wa_timestamp IS DISTINCT FROM OLD.wa_timestamp
           OR NEW.received_at IS DISTINCT FROM OLD.received_at
           OR NEW.proposal_digest IS DISTINCT FROM OLD.proposal_digest THEN
          RAISE EXCEPTION 'Proposal integrity violation: prompted transaction facts are immutable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER protect_transaction_proposal_facts
      BEFORE INSERT OR UPDATE ON transaction_proposals
      FOR EACH ROW
      EXECUTE FUNCTION protect_transaction_proposal_facts();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_confirmed_proposal_transaction()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status <> 'CONFIRMED' THEN
          RETURN NEW;
        END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM transactions transaction
          WHERE transaction.id = NEW.transaction_id
            AND transaction.business_id = NEW.business_id
            AND transaction.status = 'POSTED'
            AND transaction.currency = NEW.currency
            AND transaction.description = NEW.description
            AND transaction.idempotency_key = 'proposal:' || NEW.id::text
            AND transaction.source_type = 'WHATSAPP'
            AND transaction.source_message_id = NEW.source_wa_message_id
            AND transaction.source_payload_hash = NEW.source_payload_hash
            AND transaction.occurred_at = NEW.wa_timestamp
            AND transaction.received_at = NEW.received_at
            AND (SELECT count(*) FROM entries entry WHERE entry.transaction_id = transaction.id) = 2
            AND (
              (NEW.kind = 'SALE'
                AND EXISTS (
                  SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                  WHERE entry.transaction_id = transaction.id AND entry.type = 'DEBIT'
                    AND entry.amount_minor = NEW.amount_minor AND account.business_id = NEW.business_id
                    AND account.code = '100'
                )
                AND EXISTS (
                  SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                  WHERE entry.transaction_id = transaction.id AND entry.type = 'CREDIT'
                    AND entry.amount_minor = NEW.amount_minor AND account.business_id = NEW.business_id
                    AND account.code = '400'
                ))
              OR
              (NEW.kind = 'EXPENSE'
                AND EXISTS (
                  SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                  WHERE entry.transaction_id = transaction.id AND entry.type = 'DEBIT'
                    AND entry.amount_minor = NEW.amount_minor AND account.business_id = NEW.business_id
                    AND account.code = '500'
                )
                AND EXISTS (
                  SELECT 1 FROM entries entry JOIN accounts account ON account.id = entry.account_id
                  WHERE entry.transaction_id = transaction.id AND entry.type = 'CREDIT'
                    AND entry.amount_minor = NEW.amount_minor AND account.business_id = NEW.business_id
                    AND account.code = '100'
                ))
            )
        ) THEN
          RAISE EXCEPTION 'Proposal integrity violation: confirmed proposal does not match its posted ledger transaction';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER enforce_confirmed_proposal_transaction
      AFTER INSERT OR UPDATE ON transaction_proposals
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW
      EXECUTE FUNCTION enforce_confirmed_proposal_transaction();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS enforce_confirmed_proposal_transaction ON transaction_proposals;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_confirmed_proposal_transaction();`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS protect_transaction_proposal_facts ON transaction_proposals;`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS protect_transaction_proposal_facts();`,
    );
    await queryRunner.query(`
      ALTER TABLE transaction_proposals
      DROP CONSTRAINT IF EXISTS "UQ_transaction_proposals_transaction_id_v2",
      DROP CONSTRAINT IF EXISTS "CHK_transaction_proposals_digest_v2",
      DROP CONSTRAINT IF EXISTS "CHK_transaction_proposals_kind_v2",
      DROP COLUMN IF EXISTS proposal_digest;
    `);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS compute_transaction_proposal_digest(uuid, varchar, varchar, varchar, bigint, varchar, text, timestamptz, timestamptz);`,
    );
  }
}
