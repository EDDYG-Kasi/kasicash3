# Project Status

**Current Phase:** Phase 5 implemented locally, pending full green CI.

## Phase 4 Delivered

- Cash position/current account balances from ledger entries.
- Income statement over a timezone-explicit local date range.
- Account statement with opening balance, deltas, running balance, oldest-first ordering, and pagination.
- Reports are read-only and traceable to ledger rows. They include `POSTED` and `REVERSED` transaction rows so original plus reversal nets correctly, and exclude transient/unconfirmed rows.
- Money is returned as minor-unit strings plus formatted major-unit strings and currency code.
- Read indexes added in a new reversible migration.
- Unit and integration tests added.

## Validation

- Local `npm run build` passed on 2026-07-29.
- Local `npm run lint` passed on 2026-07-29.
- Local `npm test -- --runInBand` passed on 2026-07-29.
- Local `npm run test:integration` is blocked because this environment cannot find a working Docker/Testcontainers runtime.
- GitHub Actions should run the full suite after push.

## Phase 5 Delivered

- Conversational query routing inside the existing durable WhatsApp ingestion path.
- Query-shaped messages are handled before Phase 3 transaction parsing so unsafe query text cannot fall through into a ledger write.
- Provider-agnostic, mockable resolver interface with deterministic default resolver for CI.
- Validated intents: cash balance, income statement, expense/stock spend, and recent account transactions.
- Per-business account allowlisting before any report read; tenant scope comes from `wa_from` onboarding, not message content.
- Replies render only figures returned by Phase 4 `ReportsService`; resolver output never contains final financial numbers.
- Prompt-injection containment for cross-tenant, induced-write, scope-widening, and fabricated-number attempts.
- Unit and Testcontainers integration coverage added.
