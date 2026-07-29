# Changelog

## [Unreleased]

- Phase 4 Core Reports: added `ReportsModule`, `ReportsService`, and unauthenticated-for-now read-only report routes for cash position, income statement, and account statements.
- Added read-only database transaction guard for reports via `SET TRANSACTION READ ONLY`.
- Added migration `1700000006000-ReportReadIndexes` for report query indexes only.
- Added BigInt-only money formatting and timezone-explicit local date range handling.
- Added unit tests for report money/sign/period behavior and read-only service boundaries.
- Added Testcontainers integration test that posts real ledger transactions, reverses one, and verifies report math, reversal netting, and tenant isolation.
