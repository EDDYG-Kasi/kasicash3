# Phase 4 Reports Design

## Scope

Phase 4 adds three read-only reports derived from the immutable ledger:

- Cash position/current account balances.
- Income statement for a caller-supplied local date range.
- Account statement with running balance, oldest first, paginated.

Reports never write ledger data. They read only `accounts`, `entries`, and `transactions`, with every query scoped by `business_id` and `currency`.

## Phase 3 Data Assumption

Confirmed Phase 3 WhatsApp transactions are posted through `LedgerService.postTransaction`, so they land in the existing `transactions` and `entries` tables. Proposed/unconfirmed text does not create posted ledger entries. Reports therefore aggregate only legal ledger rows whose status is `POSTED` or `REVERSED`; this excludes transient `POSTING` rows and proposed/unconfirmed rows if they ever share the table.

Reversals net naturally: the original transaction remains part of the immutable posted history with status `REVERSED`, while the reversal transaction is `POSTED` with inverted entries. Including both legal ledger rows makes balances net to zero. Filtering only `POSTED` would incorrectly show the reversal without the original.

## Signed Balance Rules

Ledger entries store positive minor-unit amounts only. Reports map an entry to a signed minor-unit amount by account type:

- `ASSET` and `EXPENSE`: `DEBIT = +amount`, `CREDIT = -amount`.
- `LIABILITY`, `EQUITY`, and `REVENUE`: `CREDIT = +amount`, `DEBIT = -amount`.

All money remains bigint minor-unit strings in TypeScript. Formatting converts strings with `BigInt` arithmetic only; no floats.

## Query Plans

### Cash Position

Inputs: `businessId`, optional `currency` defaulting to `ZAR`.

Query plan:

- Read all accounts for the business.
- Left join same-business entries and legal ledger transactions (`POSTED`, `REVERSED`) in the requested currency.
- Group by account.
- Sum signed entries per account.
- Mark net-cash accounts as the `100` account family: `code = '100' OR code LIKE '100.%'`.
- Sum those account balances in TypeScript with `BigInt` for `netCash`.

### Income Statement

Inputs: `businessId`, local `from` date, local `to` date, optional `timezone` defaulting to `Africa/Johannesburg`, optional `currency` defaulting to `ZAR`.

Query plan:

- Convert local date range to UTC bounds: `from 00:00:00` inclusive through the day after `to 00:00:00` exclusive in the supplied timezone.
- Join entries to accounts and legal ledger transactions scoped by business, currency, and occurred-at bounds.
- Revenue = signed sum for account code family `400`.
- Expenses = signed sum for account code family `500`.
- Net income = revenue - expenses.

### Account Statement

Inputs: `businessId`, `accountId`, local date range, optional `timezone`, optional `currency`, `limit`, `offset`.

Query plan:

- Confirm the account belongs to the business.
- Opening balance = signed sum for that account before the UTC start bound.
- Period lines = legal ledger transactions touching that account in the UTC range, grouped per transaction, with a signed account delta.
- Running balance = opening balance + windowed signed deltas ordered by `occurred_at`, `posted_at`, transaction id.
- Page after the window calculation so running balances are stable across pages.

## Timezone Boundaries

The ledger stores `occurred_at` as a PostgreSQL `timestamp`. Phase 4 treats it as the UTC instant supplied by the service. Date inputs are local calendar dates. The service converts them to UTC instants using `Intl.DateTimeFormat` for the supplied IANA timezone. Because `Business` has no timezone column yet, callers pass the timezone; default is `Africa/Johannesburg`.

Deferred: persist per-business timezone and reporting preferences.

## Module Shape

- `ReportsModule`
- `ReportsService`
- `ReportsController` with unauthenticated-for-now read-only routes:
  - `GET /reports/balances`
  - `GET /reports/income-statement`
  - `GET /reports/accounts/:accountId/statement`
- DTOs in `src/reports/reports.dto.ts`
- Money/period helpers in `src/reports/reports.math.ts`

## Read-Only Guard

Every service method runs inside a database transaction followed immediately by `SET TRANSACTION READ ONLY`. The service uses raw `SELECT` queries through a `QueryRunner`; it does not call repository `save`, `update`, `delete`, `insert`, or query-builder mutation methods.

## Index Migration

Phase 4 adds read indexes only:

- `transactions (business_id, status, currency, occurred_at, id)`
- `entries (business_id, account_id, transaction_id)`
- `accounts (business_id, code, type)`

No prior ledger migration or invariant is modified.
