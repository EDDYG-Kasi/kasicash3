# Database Schema

Reflects the migrated PostgreSQL schema as of migration `1700000006000-ReportReadIndexes`.

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

## Money And Tenancy

Money remains PostgreSQL `bigint` minor units, represented as strings in TypeScript. Every report query is scoped by a single `business_id` and `currency`.
