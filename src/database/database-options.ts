import { DataSourceOptions } from 'typeorm';
import { Account } from '../ledger/entities/account.entity';
import { Business } from '../ledger/entities/business.entity';
import { Entry } from '../ledger/entities/entry.entity';
import { Transaction } from '../ledger/entities/transaction.entity';
import { InboundMessage } from '../ingestion/entities/inbound-message.entity';
import { WebhookDelivery } from '../ingestion/entities/webhook-delivery.entity';
import { TransactionProposal } from '../parsing/entities/transaction-proposal.entity';
import { AnomalyAlert } from '../anomaly/entities/anomaly-alert.entity';
import { AuthPrincipal } from '../auth/entities/auth-principal.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { WebhookReplayEvent } from '../auth/entities/webhook-replay-event.entity';
import { CreateLedgerCore1699999999000 } from '../migrations/1699999999000-CreateLedgerCore';
import { ImmutabilityTriggers1700000000000 } from '../migrations/1700000000000-ImmutabilityTriggers';
import { TenantConsistencyAndPolicies1700000001000 } from '../migrations/1700000001000-TenantConsistencyAndPolicies';
import { PostingLifecycle1700000002000 } from '../migrations/1700000002000-PostingLifecycle';
import { LedgerHardening1700000003000 } from '../migrations/1700000003000-LedgerHardening';
import { InboundMessages1700000004000 } from '../migrations/1700000004000-InboundMessages';
import { InboundRetryColumns1700000005000 } from '../migrations/1700000005000-InboundRetryColumns';
import { ReportReadIndexes1700000006000 } from '../migrations/1700000006000-ReportReadIndexes';
import { TransactionProposals1700000007000 } from '../migrations/1700000007000-TransactionProposals';
import { AnalyticsReadIndexes1700000008000 } from '../migrations/1700000008000-AnalyticsReadIndexes';
import { AnomalyAlerts1700000009000 } from '../migrations/1700000009000-AnomalyAlerts';
import { SecurityAuth1700000010000 } from '../migrations/1700000010000-SecurityAuth';
import { LedgerClassificationAndReversalIntegrity1700000011000 } from '../migrations/1700000011000-LedgerClassificationAndReversalIntegrity';
import { TimezoneAwareInstants1700000012000 } from '../migrations/1700000012000-TimezoneAwareInstants';
import { IngestionClaimsAndDurableDeliveries1700000013000 } from '../migrations/1700000013000-IngestionClaimsAndDurableDeliveries';
import { SecurityAndNotificationHardening1700000014000 } from '../migrations/1700000014000-SecurityAndNotificationHardening';
import { RoundTwoIntegrityHardening1700000015000 } from '../migrations/1700000015000-RoundTwoIntegrityHardening';
import { LegacyIntegrityPreflight1700000014500 } from '../migrations/1700000014500-LegacyIntegrityPreflight';
import { LegacyIntegrityGate1700000014900 } from '../migrations/1700000014900-LegacyIntegrityGate';
import { ProposalConfirmationIntegrity1700000016000 } from '../migrations/1700000016000-ProposalConfirmationIntegrity';
import { DowngradeAndAggregateSafety1700000017000 } from '../migrations/1700000017000-DowngradeAndAggregateSafety';

export const KASICASH_ENTITIES = [
  Business,
  Account,
  Transaction,
  Entry,
  InboundMessage,
  WebhookDelivery,
  TransactionProposal,
  AnomalyAlert,
  AuthPrincipal,
  AuthSession,
  WebhookReplayEvent,
];

export const KASICASH_MIGRATIONS = [
  CreateLedgerCore1699999999000,
  ImmutabilityTriggers1700000000000,
  TenantConsistencyAndPolicies1700000001000,
  PostingLifecycle1700000002000,
  LedgerHardening1700000003000,
  InboundMessages1700000004000,
  InboundRetryColumns1700000005000,
  ReportReadIndexes1700000006000,
  TransactionProposals1700000007000,
  AnalyticsReadIndexes1700000008000,
  AnomalyAlerts1700000009000,
  SecurityAuth1700000010000,
  LedgerClassificationAndReversalIntegrity1700000011000,
  TimezoneAwareInstants1700000012000,
  IngestionClaimsAndDurableDeliveries1700000013000,
  SecurityAndNotificationHardening1700000014000,
  LegacyIntegrityPreflight1700000014500,
  LegacyIntegrityGate1700000014900,
  RoundTwoIntegrityHardening1700000015000,
  ProposalConfirmationIntegrity1700000016000,
  DowngradeAndAggregateSafety1700000017000,
];

export function buildPostgresDataSourceOptions(
  getValue: (name: string) => string | undefined,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: getValue('DB_HOST') ?? 'localhost',
    port: parsePort(getValue('DB_PORT')),
    username: getValue('DB_USER') ?? 'postgres',
    password: getValue('DB_PASSWORD') ?? 'postgres',
    database: getValue('DB_NAME') ?? 'kasicash',
    entities: KASICASH_ENTITIES,
    migrations: KASICASH_MIGRATIONS,
    migrationsTransactionMode: 'each',
    synchronize: false,
  };
}

function parsePort(raw?: string): number {
  const port = Number(raw ?? 5432);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 5432;
}
