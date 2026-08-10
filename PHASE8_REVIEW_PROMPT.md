# Independent Review Prompt: Phase 8 Round 1

You are a senior full-stack/backend accounting-systems engineer performing an
independent review of KasiCash Phase 8: Web Dashboard.

Start with a receipt check: confirm which delivered files are present for Phase
8, including design, dashboard module/controller/service/tenant guard/frontend
renderer/DTOs, unit tests, Testcontainers endpoint integration test, ADR/docs
updates, environment guard documentation, and this review prompt.

Review against the KasiCash engineering constitution:

- Verify the dashboard is strictly read-only. Hunt for any new ledger-write
  path, `LedgerService` usage, mutation endpoint, direct INSERT/UPDATE/DELETE
  against financial tables, or dashboard bypass around confirm-then-post.
- Verify figures come from existing read services: Phase 4 reports, Phase 6
  analytics, and Phase 7 anomalies. The dashboard must not rederive report math
  or invent figures.
- Verify server-side tenant scoping cannot be overridden by the client. The
  client must not be able to select another `businessId`, `currency`, or
  `timezone`; Phase 8 must use the explicit server-side tenant stub only.
- Verify the Phase 9 auth boundary is explicit: dashboard routes are disabled
  without `KASICASH_DASHBOARD_ENABLED=true` and a configured
  `KASICASH_DASHBOARD_BUSINESS_ID`, and the DTO marks the boundary as not
  production auth.
- Verify money rendering uses existing `MoneyDto.formatted` display strings or
  bigint-compatible minor-unit strings at the view boundary only. Hunt for
  `parseFloat`, float money, client-side aggregation, or recomputed financial
  totals.
- Verify alert status metadata reads are read-only, tenant-scoped, and do not
  mutate alerts or financial records.
- Check backend contract/tenant tests: a request attempting to pass another
  business id must still return/call only the server-configured business.
- Check front-end tests: rendered values must match DTO formatted strings and
  not expose raw minor units or recompute money.
- Check the Testcontainers integration test's endpoint response against real
  Postgres: report figures, analytics figures, reversal netting, pending
  proposal exclusion, alert metadata scoping, and other-tenant exclusion.
- Check CI coverage: backend, front-end renderer tests, and the new dashboard
  integration test should run in the existing Jest/GitHub Actions pipeline.

Hunt specifically for ledger writes, client-side money math, fabricated figures,
cross-tenant access, unauthenticated data exposure, route enablement that is too
easy to ship publicly, and drift from Phase 4/6/7 read services.

Rate correctness, constitution compliance, tenant isolation, UI/BFF
maintainability, test strength, and production-readiness caveats. Give a
verdict on completeness pending green CI, and list any blocking fixes before
Phase 8 can be accepted.
