# Project Status

**Current Phase:** Phase 4 implemented locally, pending full green CI.

## Phase 4 Delivered

- Cash position/current account balances from ledger entries.
- Income statement over a timezone-explicit local date range.
- Account statement with opening balance, deltas, running balance, oldest-first ordering, and pagination.
- Reports are read-only and traceable to ledger rows. They include `POSTED` and `REVERSED` transaction rows so original plus reversal nets correctly, and exclude transient/unconfirmed rows.
- Money is returned as minor-unit strings plus formatted major-unit strings and currency code.
- Read indexes added in a new reversible migration.
- Unit and integration tests added.

## Pending Validation

- Local build/lint/unit tests must pass after implementation.
- Integration tests require Docker/Testcontainers.
- GitHub Actions should run the full suite after push.
