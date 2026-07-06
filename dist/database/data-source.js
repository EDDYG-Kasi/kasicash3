"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const business_entity_1 = require("../ledger/entities/business.entity");
const account_entity_1 = require("../ledger/entities/account.entity");
const transaction_entity_1 = require("../ledger/entities/transaction.entity");
const entry_entity_1 = require("../ledger/entities/entry.entity");
const inbound_message_entity_1 = require("../ingestion/entities/inbound-message.entity");
const _1699999999000_CreateLedgerCore_1 = require("../migrations/1699999999000-CreateLedgerCore");
const _1700000000000_ImmutabilityTriggers_1 = require("../migrations/1700000000000-ImmutabilityTriggers");
const _1700000001000_TenantConsistencyAndPolicies_1 = require("../migrations/1700000001000-TenantConsistencyAndPolicies");
const _1700000002000_PostingLifecycle_1 = require("../migrations/1700000002000-PostingLifecycle");
const _1700000003000_LedgerHardening_1 = require("../migrations/1700000003000-LedgerHardening");
const _1700000004000_InboundMessages_1 = require("../migrations/1700000004000-InboundMessages");
const _1700000005000_InboundRetryColumns_1 = require("../migrations/1700000005000-InboundRetryColumns");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'kasicash',
    entities: [business_entity_1.Business, account_entity_1.Account, transaction_entity_1.Transaction, entry_entity_1.Entry, inbound_message_entity_1.InboundMessage],
    migrations: [
        _1699999999000_CreateLedgerCore_1.CreateLedgerCore1699999999000,
        _1700000000000_ImmutabilityTriggers_1.ImmutabilityTriggers1700000000000,
        _1700000001000_TenantConsistencyAndPolicies_1.TenantConsistencyAndPolicies1700000001000,
        _1700000002000_PostingLifecycle_1.PostingLifecycle1700000002000,
        _1700000003000_LedgerHardening_1.LedgerHardening1700000003000,
        _1700000004000_InboundMessages_1.InboundMessages1700000004000,
        _1700000005000_InboundRetryColumns_1.InboundRetryColumns1700000005000,
    ],
    synchronize: false,
});
exports.default = exports.AppDataSource;
//# sourceMappingURL=data-source.js.map