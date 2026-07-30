import { DataSource } from 'typeorm';
import { Business } from '../ledger/entities/business.entity';
import { Account } from '../ledger/entities/account.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { Entry } from '../ledger/entities/entry.entity';
import { InboundMessage } from '../ingestion/entities/inbound-message.entity';
import { TransactionProposal } from '../parsing/entities/transaction-proposal.entity';
import { CreateLedgerCore1699999999000 } from '../migrations/1699999999000-CreateLedgerCore';
import { ImmutabilityTriggers1700000000000 } from '../migrations/1700000000000-ImmutabilityTriggers';
import { TenantConsistencyAndPolicies1700000001000 } from '../migrations/1700000001000-TenantConsistencyAndPolicies';
import { PostingLifecycle1700000002000 } from '../migrations/1700000002000-PostingLifecycle';
import { LedgerHardening1700000003000 } from '../migrations/1700000003000-LedgerHardening';
import { InboundMessages1700000004000 } from '../migrations/1700000004000-InboundMessages';
import { InboundRetryColumns1700000005000 } from '../migrations/1700000005000-InboundRetryColumns';
import { ReportReadIndexes1700000006000 } from '../migrations/1700000006000-ReportReadIndexes';
import { TransactionProposals1700000007000 } from '../migrations/1700000007000-TransactionProposals';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'kasicash',
  entities: [
    Business,
    Account,
    Transaction,
    Entry,
    InboundMessage,
    TransactionProposal,
  ],
  migrations: [
    CreateLedgerCore1699999999000,
    ImmutabilityTriggers1700000000000,
    TenantConsistencyAndPolicies1700000001000,
    PostingLifecycle1700000002000,
    LedgerHardening1700000003000,
    InboundMessages1700000004000,
    InboundRetryColumns1700000005000,
    ReportReadIndexes1700000006000,
    TransactionProposals1700000007000,
  ],
  synchronize: false,
});

export default AppDataSource;
