import { MigrationInterface, QueryRunner } from 'typeorm';

/** Prevents aggregate overflow and refuses ambiguous alert-state downgrades. */
export class DowngradeAndAggregateSafety1700000017000 implements MigrationInterface {
  name = 'DowngradeAndAggregateSafety1700000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(numericBalanceFunction());
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT count(*)::text AS count
      FROM anomaly_alerts
      WHERE status = 'DELIVERY_UNCERTAIN';
    `)) as unknown as Array<{ count: string }>;
    const uncertainCount = BigInt(rows[0]?.count ?? '0');
    if (uncertainCount > 0n) {
      throw new Error(
        `Downgrade blocked: ${uncertainCount.toString()} DELIVERY_UNCERTAIN alert(s) require explicit operator reconciliation`,
      );
    }
    await queryRunner.query(bigintBalanceFunction());
  }
}

function numericBalanceFunction(): string {
  return `
    CREATE OR REPLACE FUNCTION enforce_balanced_transaction()
    RETURNS TRIGGER AS $$
    DECLARE
      total_debits numeric;
      total_credits numeric;
      entry_count integer;
    BEGIN
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor::numeric ELSE 0::numeric END), 0::numeric),
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_minor::numeric ELSE 0::numeric END), 0::numeric),
        COUNT(*)
      INTO total_debits, total_credits, entry_count
      FROM entries
      WHERE transaction_id = NEW.transaction_id;

      IF entry_count < 2 THEN
        RAISE EXCEPTION 'Double-entry violation: Transaction % has fewer than 2 entries', NEW.transaction_id;
      END IF;
      IF total_debits != total_credits THEN
        RAISE EXCEPTION 'Double-entry violation: Transaction % is unbalanced (Debits: %, Credits: %)', NEW.transaction_id, total_debits, total_credits;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
}

function bigintBalanceFunction(): string {
  return `
    CREATE OR REPLACE FUNCTION enforce_balanced_transaction()
    RETURNS TRIGGER AS $$
    DECLARE
      total_debits bigint;
      total_credits bigint;
      entry_count integer;
    BEGIN
      SELECT
        COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount_minor ELSE 0 END), 0),
        COUNT(*)
      INTO total_debits, total_credits, entry_count
      FROM entries
      WHERE transaction_id = NEW.transaction_id;

      IF entry_count < 2 THEN
        RAISE EXCEPTION 'Double-entry violation: Transaction % has fewer than 2 entries', NEW.transaction_id;
      END IF;
      IF total_debits != total_credits THEN
        RAISE EXCEPTION 'Double-entry violation: Transaction % is unbalanced (Debits: %, Credits: %)', NEW.transaction_id, total_debits, total_credits;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
}
