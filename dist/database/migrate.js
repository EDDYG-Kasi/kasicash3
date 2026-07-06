"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = __importDefault(require("./data-source"));
const command = process.argv[2] ?? 'up';
async function main() {
    await data_source_1.default.initialize();
    if (command === 'down') {
        await data_source_1.default.undoLastMigration();
    }
    else if (command === 'down:all') {
        for (;;) {
            const rows = await data_source_1.default.query(`SELECT COUNT(*)::int AS count FROM migrations`);
            if (!rows.length || Number(rows[0].count) === 0)
                break;
            await data_source_1.default.undoLastMigration();
        }
    }
    else {
        await data_source_1.default.runMigrations();
    }
    await data_source_1.default.destroy();
    console.log(`migration ${command} complete`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map