# Changelog

## [Unreleased]

- Phase 4 Core Reports: added `ReportsModule`, `ReportsService`, and disabled-by-default read-only report routes for cash position, income statement, and account statements.
- Added read-only database transaction guard for reports via `SET TRANSACTION READ ONLY`.
- Added migration `1700000006000-ReportReadIndexes` for report query indexes only.
- Added BigInt-only money formatting and timezone-explicit local date range handling.
- Added unit tests for report money/sign/period behavior and read-only service boundaries.
- Added Testcontainers integration test that posts real ledger transactions, reverses one, and verifies report math, reversal netting, and tenant isolation.
- Phase 5 Conversational Queries: added a read-only WhatsApp query layer that routes query-shaped text before Phase 3 parsing, validates resolver proposals against business-scoped account allowlists, calls Phase 4 reports, and renders plain-language replies.
- Added a provider-agnostic `CONVERSATIONAL_QUERY_RESOLVER` interface with deterministic CI-safe resolver implementation.
- Added prompt-injection containment for scope-widening/write/fabricated-figure instructions.
- Added Phase 5 unit tests and Testcontainers integration coverage for cash, income, spend, recent sales, reversal netting, tenant isolation, and no mutation on query.
- Constitution hardening: Phase 3 transaction parsing now creates durable `transaction_proposals`; `LedgerService.postTransaction` is called only after a later explicit YES/confirm message from the same `wa_from`-resolved business.
- Added migration `1700000007000-TransactionProposals` and disabled caller-selected HTTP report routes by default (`KASICASH_REPORT_ROUTES=false`) to avoid untrusted tenant selection outside WhatsApp context.
