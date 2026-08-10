import AppDataSource from './data-source';

const command = process.argv[2] ?? 'up';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  if (command === 'down') {
    await AppDataSource.undoLastMigration();
  } else if (command === 'down:all') {
    // Revert the entire chain, proving every migration's down() in order.
    // Loop on EXECUTED migrations (the migrations table), not showMigrations()
    // which reports PENDING migrations — after `run` there are none pending.
    for (;;) {
      const rows: Array<{ count: number }> = await AppDataSource.query(
        `SELECT COUNT(*)::int AS count FROM migrations`,
      );
      if (!rows.length || Number(rows[0].count) === 0) break;
      await AppDataSource.undoLastMigration();
    }
  } else {
    await AppDataSource.runMigrations({ transaction: 'each' });
  }
  await AppDataSource.destroy();
  console.log(`migration ${command} complete`);
}

main().catch(() => {
  console.error('migration failed error_code=MIGRATION_OPERATION_FAILED');
  process.exit(1);
});
