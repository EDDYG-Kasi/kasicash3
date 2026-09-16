# Independent Review Prompt: Phase 8 Round 1

You are a senior full-stack/backend accounting-systems engineer performing an
independent review of KasiCash Phase 8: polished read-only Web Dashboard.

Start with a receipt check. Confirm the delivered Phase 8 files are present:
`PHASE8_DASHBOARD_DESIGN.md`, `src/dashboard/*`, dashboard DTO/service/
controller/tenant guard/frontend renderer, dashboard unit tests, the
Testcontainers dashboard integration test, browser login page, deployment
scaffolding, ADR/docs updates, and this review prompt.

Review against the KasiCash engineering constitution:

- Verify the dashboard is strictly read-only. Hunt for any new ledger-write
  path, `LedgerService` usage, mutation endpoint, direct INSERT/UPDATE/DELETE
  against financial tables, or dashboard bypass around confirm-then-post.
- Verify figures come from existing read services: Phase 4 reports, Phase 6
  analytics, and Phase 7 anomalies. The dashboard must not rederive report math,
  invent figures, or create a separate financial cache.
- Verify server-side tenant scoping cannot be overridden by the client. The
  client must not be able to select another `businessId`, `currency`, or
  `timezone`. Current code should use Phase 9 authenticated principal context;
  if a Phase 8 stub is still present, treat it as a production blocker.
- Verify authenticated dashboard/report routes reject unauthenticated requests
  and ignore manipulated tenant IDs, currency, timezone, and cross-tenant
  account IDs.
- Verify `GET /auth/login` is only a browser wrapper around the existing
  `POST /auth/login` session API. It must rely on the HttpOnly cookie, redirect
  to `/dashboard`, and must not store bearer tokens in local/session storage.
- Verify deployment scaffolding does not weaken production checks, auth,
  WhatsApp config requirements, tenant isolation, or ledger invariants.
- Verify money rendering uses existing `MoneyDto.formatted` display strings or
  server-provided non-financial chart-scale strings only. Hunt for `parseFloat`,
  `Number()` money conversion, `.toFixed()` money formatting, raw minor-unit
  exposure in the browser, client-side aggregation, or recomputed financial
  totals.
- Verify period/account filters call the BFF and existing read services rather
  than recomputing in the browser.
- Verify empty, loading, and error states are handled without leaking raw
  exceptions, private financial text, or secrets.
- Verify alert status metadata reads are read-only, tenant-scoped, and do not
  mutate alerts or financial records.
- Check backend contract and tenant tests: a request attempting to pass another
  business id must still return/call only the authenticated principal's
  business.
- Check front-end tests: rendered values must match DTO formatted strings, chart
  widths must come from server DTO strings, and empty-state rendering must work.
- Check the Testcontainers integration test's endpoint response against real
  Postgres: report figures, analytics figures, reversal netting, pending
  proposal exclusion, alert metadata scoping, and other-tenant exclusion.
- Check CI coverage: build, lint, unit tests, front-end renderer tests, and the
  dashboard integration test should run in the existing Jest/GitHub Actions
  pipeline.

Hunt specifically for ledger writes, client-side money math, fabricated figures,
cross-tenant access, unauthenticated data exposure, route enablement that is too
easy to ship publicly, and drift from Phase 4/6/7 read services.

Rate correctness, constitution compliance, tenant isolation, UI/BFF
maintainability, test strength, and production-readiness caveats. Give a
verdict on completeness pending green CI, and list any blocking fixes before
Phase 8 can be accepted.
