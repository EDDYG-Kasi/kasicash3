# Database Schema

Reflects the migrated PostgreSQL schema as of migration
`1700000015000-RoundTwoIntegrityHardening`.

## Round Two Integrity Hardening

Migration `1700000015000` closes the second independent-review findings without
editing any prior migration:

- `business_id`, `code`, and `type` are unconditionally immutable after an
  account is created. Corrections require a replacement account, eliminating
  the first-entry/account-update race.
- `supported_currencies` is the database authority for ZAR, USD, JPY, and BHD,
  including minor-unit scale and provisional bigint anomaly floors.
- Foreign keys bind `transactions.currency`, `transaction_proposals.currency`,
  `auth_principals.default_currency`, and `anomaly_alerts.currency` to that
  registry.
- External transaction provenance is restricted to an explicit source allowlist
  and exact lowercase SHA-256 payload hashes; WhatsApp transactions also require
  their source message identifier.
- Proposal payload hashes are exact lowercase SHA-256 values.

The migration is reversible. Its `down()` restores the previous referenced-only
account trigger and removes only the constraints/table introduced by this
migration.

## Phase 10 Schema Note

Phase 10 adds no database migration, no ledger tables, no financial cache, and
no derived aggregate state. Observability reads existing operational tables and
exposes sanitized process/database/recovery signals only.

The authenticated dead-letter endpoint reads `inbound_messages` metadata scoped
by the authenticated principal's `business_id`. It does not return raw payloads,
message text, phone numbers, or money values.

## WhatsApp Outbound Schema Note

TD-3 adds no database migration. Outbound Cloud API sends remain best-effort
side effects behind `WhatsAppClient`; they do not create financial records,
ledger rows, report caches, or message status tables.

TD-5 remains deferred until a dedicated non-financial outbound table can store
provider `wamid` values and reconcile `sent`/`delivered`/`read`/`failed`
callbacks safely.

## Phase 9 Schema Note

Phase 9 adds authentication and webhook replay metadata only. It does not alter
ledger tables, ledger immutability triggers, report math, analytics math, or
anomaly detection rules.

New tables:

- `auth_principals`
- `auth_sessions`
- `webhook_replay_events`

`auth_principals.business_id` binds each principal to exactly one business.
Controllers derive tenant context from the authenticated principal and never
from caller-supplied `businessId` values.

`auth_sessions` stores only SHA-256 hashes of opaque session tokens, with
expiry and optional revocation. Raw session tokens are returned only at login
and may be sent via bearer token or HttpOnly SameSite cookie.

`webhook_replay_events` stores payload and signature hashes for successful
WhatsApp webhook deliveries. Replay rows are not financial records and do not
replace inbound-message idempotency.

## Phase 8 Schema Note

Phase 8 adds no database migration, no ledger tables, no dashboard write tables,
and no cached financial aggregate state. The dashboard reads existing tables
only through Phase 4 reports, Phase 6 analytics, and Phase 7 anomaly metadata.

The only direct dashboard SQL is a read-only `SELECT` from `anomaly_alerts`
scoped by the authenticated principal's server-derived `business_id`.

## Phase 7 Schema Note

Phase 7 anomaly detection mutates no ledger data. It adds one notification
metadata table:

- `anomaly_alerts`

This table records idempotency and delivery state for proactive WhatsApp alerts.
It is not a financial record of truth and does not replace ledger-derived
figures. Alert payload snapshots are for delivery audit/debugging only; anomaly
facts remain rebuildable from the posted ledger history and deterministic rules.

## Phase 6 Schema Note

Visual analytics add no financial tables, no chart cache, and no materialized
aggregate state. `AnalyticsService` reads the legal ledger tables directly and
returns chart-ready DTOs for:

- cash balance over time
- income vs expenses per bucket
- spend-by-account breakdowns

Analytics use the same posted-history filter as Phase 4:

```sql
transactions.status IN ('POSTED', 'REVERSED')
```

This includes a reversed original plus its posted reversal transaction so the
two net correctly, and excludes transient/unconfirmed rows.

## Phase 5 Schema Note

Conversational queries reuse the Phase 4 read-only report paths and add no read cache/materialized report state. The Phase 3 constitution hardening adds `transaction_proposals` so parsed WhatsApp transaction text is durable but unposted until the trader confirms it.

`transaction_proposals` is not a financial record of truth. It is a bounded pending-command table:

- `business_id` scopes the proposal to the business resolved from `wa_from`.
- `source_wa_message_id` and `source_payload_hash` trace the original transaction text.
- `kind`, `amount_minor`, `currency`, `description`, `wa_timestamp`, and `received_at` hold the proposed transaction parameters.
- `status` is `PENDING`, `CONFIRMED`, or `CANCELLED`.
- `confirmed_by_wa_message_id` and `transaction_id` are set only when status is `CONFIRMED`.

Only a `CONFIRMED` proposal may correspond to a ledger transaction, and the posted transaction still lives in the legal ledger tables.

## Reporting Addendum

Phase 4 adds no report tables and no materialized cache. Reports read the legal ledger tables directly:

- `accounts`
- `entries`
- `transactions`

Report queries include only legal posted-history transaction rows:

```sql
transactions.status IN ('POSTED', 'REVERSED')
```

This deliberately includes a reversed original transaction plus its posted reversal transaction, so the two sets of entries net to zero. It excludes transient or unconfirmed states such as `POSTING` and any future `PROPOSED` state.

## Migration 1700000006000

Read-only indexes added for Phase 4:

- `IDX_transactions_reports_business_status_currency_occurred` on `transactions (business_id, status, currency, occurred_at, id)`
- `IDX_entries_reports_business_account_transaction` on `entries (business_id, account_id, transaction_id)`
- `IDX_accounts_reports_business_code_type` on `accounts (business_id, code, type)`

The migration is reversible and does not alter ledger invariants.

## Migration 1700000007000

Durable proposal table added for Phase 3 confirm-first transaction parsing:

- table `transaction_proposals`
- unique `(business_id, source_wa_message_id)`
- partial unique `(business_id, confirmed_by_wa_message_id)` where confirmed message is present
- partial unique `(business_id)` where status is `PENDING`
- status, positive amount, currency, and confirmed-shape checks
- business FK to `businesses(id)`
- composite FK `(business_id, transaction_id)` to `transactions(business_id, id)`

The migration is reversible and does not edit any prior migration.

## Migration 1700000008000

Read-only indexes added for Phase 6 analytics:

- partial `IDX_transactions_analytics_posted_business_currency_occurred` on `transactions (business_id, currency, occurred_at, id)` where status is `POSTED` or `REVERSED`
- `IDX_entries_analytics_business_transaction_account` on `entries (business_id, transaction_id, account_id)`

The migration is reversible, creates no derived financial state, and does not
edit any prior migration.

## Migration 1700000009000

Notification metadata table added for Phase 7 alerts:

- table `anomaly_alerts`
- unique `(business_id, anomaly_key)` for idempotent alert dispatch
- migration `9000` initially defines `SENDING`, `SENT`, or `FAILED`; migration
  `1400` adds terminal `DELIVERY_UNCERTAIN` for post-dispatch ambiguity
- `attempts`, `sent_at`, `created_at`, and `updated_at` track delivery state;
  migration `1400` replaces raw provider errors with bounded
  `last_error_code` and adds `dispatch_started_at`
- business FK to `businesses(id)`
- index `IDX_anomaly_alerts_business_status_updated` for retry/status scans

The migration is reversible, creates no ledger-derived aggregate cache, and
does not edit any prior migration.

## Migration 1700000010000

Authentication and webhook replay metadata added for Phase 9:

- table `auth_principals`
- unique `email_normalized`
- `business_id` foreign key to `businesses(id)`
- `status` is `ACTIVE` or `DISABLED`
- table `auth_sessions`
- unique SHA-256 `token_hash`
- `expires_at`, `revoked_at`, and `created_at` enforce revocable opaque sessions
- table `webhook_replay_events`
- unique SHA-256 `payload_hash`
- SHA-256 `signature_hash`
- `expires_at` plus index for replay-window cleanup

The migration is reversible, adds no ledger-write path, and does not edit any
prior migration.

## Money And Tenancy

Money remains PostgreSQL `bigint` minor units, represented as strings in TypeScript. Every report and analytics query is scoped by a single `business_id` and `currency`.

## Migration 1700000011000

Ledger classification and reversal integrity hardening:

- referenced account `business_id`, `code`, and `type` become immutable once an entry uses the account;
- transaction currency is restricted to the explicit supported registry: `ZAR`, `USD`, `JPY`, and `BHD`;
- every posted reversal must reference a `REVERSED` original in the same business and currency;
- every `REVERSED` original must have a posted same-business, same-currency reversal.

Both directions are enforced by deferred database triggers so the legal two-row
reversal transition remains atomic while forged/orphan/cross-currency reversal
states cannot commit.

## Migration 1700000012000

All columns that represent instants are converted from `timestamp` to
`timestamptz`. Existing values are interpreted explicitly as UTC during the
conversion, and the reversible down migration converts explicitly through UTC.
Local calendar fields such as anomaly period dates remain `date` values.

## Migration 1700000013000

Durable ingestion and claim fencing:

- monotonic `inbound_messages.ingest_sequence` establishes per-sender arrival order;
- `claim_token` and `lease_expires_at` form a fenced processing lease;
- database checks require claim fields exactly when status is `PROCESSING`;
- raw processing errors are forbidden and replaced with bounded `error_code` values;
- `webhook_deliveries` stores the exact authenticated raw bytes plus payload/signature hashes and terminal `ACCEPTED` or `QUARANTINED` state;
- indexes support sender ordering, expired-lease recovery, and quarantine inspection.

## Migration 1700000014000

Security and outbound notification hardening:

- `anomaly_alerts.dispatch_started_at` distinguishes a claimed alert from one whose external send began;
- ambiguous sends become terminal `DELIVERY_UNCERTAIN` and are not retried automatically;
- raw provider errors are forbidden and replaced by `last_error_code`;
- `security_rate_limits` provides shared, hashed, expiring rate-limit buckets across application instances.

Application boot, migration CLI, and every integration test import the same
canonical entity and migration catalog from `src/database/database-options.ts`.

## Migration 1700000015000

Round-two review hardening:

- unconditional account classification immutability;
- one supported-currency reference table used by every currency-bearing table;
- currency-specific bigint anomaly floors for ZAR, USD, JPY, and BHD;
- exact source-type and SHA-256 provenance constraints for transactions and
  proposals.

Application startup has no synchronized or in-memory database mode. PostgreSQL
with the canonical migration catalog is the only runtime database path.

## Migrations 1700000014500 and 1700000014900

Legacy-integrity upgrade staging precedes the stricter `1500` constraints:

- `legacy_integrity_remediations` records reversible, semantics-preserving
  canonicalization of recognized source/hash/kind/currency forms;
- `legacy_integrity_preflight` stores only bounded category/count diagnostics;
- ambiguous provenance, currency, proposal kind, or confirmed-proposal linkage
  is never invented or silently rewritten;
- the gate fails before `1500` until every category count is zero;
- migrations run transaction-per-migration so diagnostics survive a gate failure.

## Migration 1700000016000

Proposal confirmation integrity:

- `transaction_proposals.proposal_digest` is generated by PostgreSQL from the
  tenant, source/provenance, kind, amount, currency, description, and instants;
- proposal source/economic facts and the digest are immutable after insert;
- kind is restricted to `SALE` or `EXPENSE`, and one transaction can satisfy at
  most one proposal;
- a deferred trigger verifies a confirmed proposal's exact posted transaction,
  provenance, amount/currency, timestamps, two-entry shape, and seed-account
  mapping before commit.

## Migration 1700000017000

- balance-trigger totals use PostgreSQL `numeric`; stored entry amounts remain
  `bigint` minor units;
- downgrade refuses while any alert is `DELIVERY_UNCERTAIN`, preventing silent
  conversion into retryable `FAILED` state.
