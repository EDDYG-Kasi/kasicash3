import { MigrationInterface, QueryRunner } from 'typeorm';

/** Refuses stricter constraints until all ambiguous legacy rows are resolved. */
export class LegacyIntegrityGate1700000014900 implements MigrationInterface {
  name = 'LegacyIntegrityGate1700000014900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT refresh_legacy_integrity_preflight()::text AS total,
             (
               SELECT string_agg(category || '=' || row_count::text, ', ' ORDER BY category)
               FROM legacy_integrity_preflight
               WHERE row_count > 0
             ) AS summary;
    `)) as unknown as Array<{ total: string; summary: string | null }>;
    const total = BigInt(rows[0]?.total ?? '0');
    if (total > 0n) {
      throw new Error(
        `Legacy integrity preflight blocked migration: ${rows[0]?.summary ?? 'unresolved rows'}`,
      );
    }
  }

  public down(): Promise<void> {
    return Promise.resolve();
  }
}
