# Architecture Decision Records

## ADR 11: Phase 4 reports are read-only ledger aggregations

* **Date**: 2026-07-29
* **Context**: Core reports must summarize cash, income/expense, and account history without weakening the immutable ledger. The ledger is the single legal record; report figures must be traceable to posted entries and must not drift from cached/materialized state.
* **Decision**: Phase 4 reports are pure read-only aggregations over `accounts`, `entries`, and `transactions`. `ReportsService` runs every report inside a database transaction followed by `SET TRANSACTION READ ONLY`, then uses SELECT-only SQL through a `QueryRunner`. Reports include legal posted-history rows with status `POSTED` or `REVERSED`, and exclude transient/unconfirmed states such as `POSTING` or any future `PROPOSED` state. This is required because a reversal leaves the original row as `REVERSED` and creates a posted reversing transaction; including both makes balances net to zero.
* **Money**: All amounts remain integer minor-unit strings. Formatting uses `BigInt` arithmetic only; no floats.
* **Tenant scope**: Every report query filters by one `business_id`. Account statements first verify the requested account belongs to that business.
* **Timezone**: Callers pass an IANA timezone, defaulting to `Africa/Johannesburg` until businesses store timezone preferences. Local date ranges are converted to UTC bounds by the service.
* **Indexes**: Migration `1700000006000-ReportReadIndexes` adds read indexes only. No prior ledger migration or invariant is modified.
* **Consequences**: Reports are deterministic and traceable, but Phase 4 does not support cached dashboards, auth-bound access control, custom report types, or persisted per-business timezone settings. Those are deferred.
