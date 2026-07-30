# Database Schema

Reflects the migrated PostgreSQL schema as of migration `1700000007000-TransactionProposals`.

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

## Money And Tenancy

Money remains PostgreSQL `bigint` minor units, represented as strings in TypeScript. Every report query is scoped by a single `business_id` and `currency`.
