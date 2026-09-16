# Project Status

**Current Phase:** Phases 1-10 implemented, premium Phase 8 app/site redesign implemented locally across the public website, auth pages, and read-only dashboard, independent-review rounds 1-3 remediated locally, and TD-3 WhatsApp Cloud outbound send hardening implemented locally; production readiness remains pending green real-PostgreSQL CI, an immutable commit/CI URL, manual Meta sandbox send evidence, deployment validation, formal legal review, and accessibility/device testing.

## Phase 4 Delivered

- Cash position/current account balances from ledger entries.
- Income statement over a timezone-explicit local date range.
- Account statement with opening balance, deltas, running balance, oldest-first ordering, and pagination.
- Reports are read-only and traceable to ledger rows. They include `POSTED` and `REVERSED` transaction rows so original plus reversal nets correctly, and exclude transient/unconfirmed rows.
- Money is returned as minor-unit strings plus formatted major-unit strings and currency code.
- Read indexes added in a new reversible migration.
- Unit and integration tests added.

## Validation

- Local AI visual-review final copy cleanup passed on 2026-09-16: public
  source/spec wording now uses `setup request page` rather than the residual
  old acquisition-page phrase flagged in closeout review, with focused public/auth
  renderer tests passing (4 suites, 17 tests), full Jest passing (32 suites,
  228 tests), Nest build passing, ESLint passing, and text verification passing.
- Local AI visual-review closeout polish passed on 2026-09-15: focused
  renderer/controller tests passed (4 suites, 20 tests), full Jest passed (32
  suites, 227 tests), Nest build passed, ESLint passed, and text verification
  passed. This removes the residual generic `Sign Up` browser title and
  generated email-body wording in favour of setup-request language.
- Local AI visual-review round-2 remediation passed on 2026-09-15: focused
  renderer/controller tests passed (5 suites, 25 tests), full Jest passed (32
  suites, 227 tests), Nest build passed, ESLint passed, and text verification
  passed. This specifically verifies visible mobile navigation, About and
  Dashboard login mobile links, dark-surface label contrast treatment,
  `Request setup` wording, and the email-draft handoff language.
- Local AI visual-review remediation passed on 2026-09-15: focused
  renderer/controller tests passed (5 suites, 24 tests), full Jest passed (32
  suites, 226 tests), Nest build passed, ESLint passed, and text verification
  passed. The first HTTP smoke attempt found no server listening on
  `127.0.0.1:3000`, so preview availability was restarted separately and is not
  counted as database-backed CI evidence.
- Local Apple-restraint public/auth redesign correction passed on 2026-09-14:
  focused renderer/controller tests passed (5 suites, 21 tests), full Jest
  passed (32 suites, 226 tests), Nest build passed, ESLint passed, text
  verification passed, and HTTP preview checks passed for the homepage, signup,
  privacy, and terms routes.
- Local premium app redesign renderer/controller tests passed on 2026-09-13: 6
  suites, 22 tests (`design-system`, `public-site.frontend`,
  `app.controller`, `auth.frontend`, `auth.controller`,
  `dashboard.frontend`).
- Local focused public/auth-site tests passed on 2026-08-16: 4 suites, 11
  tests (`app.controller`, `public-site.frontend`, `auth.frontend`,
  `auth.controller`).
- Local build passed on 2026-08-16 after the public marketing webpage and
  sign-up route change.
- Local ESLint passed on 2026-08-16 after the public marketing webpage and
  sign-up route change.
- Local text-hygiene verification passed on 2026-08-16 after the public
  marketing webpage and sign-up route change.
- Local build passed on 2026-08-10 after Phase 8 polished dashboard refresh.
- Local ESLint passed on 2026-08-10 after Phase 8 polished dashboard refresh.
- Local focused auth/dashboard website tests passed on 2026-08-10: 3 suites,
  16 tests.
- Local Jest unit run passed on 2026-08-10: 29 suites, 206 tests.
- Local text-hygiene verification passed on 2026-08-10 after Phase 8 polished dashboard refresh.
- `npm audit` passed with 0 production or development vulnerabilities on 2026-08-02.
- Local `npm audit` was not rerun on 2026-08-10 because this PowerShell runtime
  does not expose an `npm` executable; CI retains the `npm audit
--audit-level=moderate` gate.
- Local mock HTTP WhatsApp Cloud integration passed on 2026-08-10: 1 suite, 2
  tests, with no live Meta call.
- Local dashboard Testcontainers integration was attempted on 2026-08-10 and
  remains environment-blocked before setup because this machine has no working
  container runtime (`Could not find a working container runtime strategy`). CI
  remains the required real-PostgreSQL verdict for all PostgreSQL suites.
- CI now verifies build, non-mutating lint, whitespace plus clean diff, unit tests, Testcontainers integration, dependency audit, and the full migration run/revert/run/revert-all chain.
- GitHub Actions should run the full suite after push.

## WhatsApp Outbound Integration Delivered

- TD-3 is locally closed: `CloudApiWhatsAppClient` now uses a pinned versioned
  Graph API endpoint, bearer auth, the documented text-message request shape,
  bounded timeouts, and accepted-response validation for `wamid.*` provider ids.
- Send failures are classified as retryable or permanent using a sanitized
  `WhatsAppDeliveryError`; provider raw body text, access tokens, full phone
  numbers, and message bodies are never logged or thrown.
- The provider abstraction remains intact: ingestion, anomaly alerts, and
  business logic still call only `WhatsAppClient.sendText`.
- Best-effort semantics are preserved: inbound rows are finalized as
  `PROCESSED` before reply send, and a send failure does not mark the inbound
  row failed, trigger recovery, re-run parsing, or mutate the ledger.
- CI coverage uses fetch stubs and a local mock HTTP server only. Live Meta
  sends are documented as a manual sandbox verification step and must not run
  in CI.
- TD-5 remains open: delivery-status callbacks should be persisted only after
  outbound provider message ids and attempts are stored in a dedicated
  non-financial table.
- Post-review TD-3 polish lowered the default Cloud API send timeout to 5
  seconds so provider brownouts hold best-effort reply work for less time.

## Phase 5 Delivered

- Conversational query routing inside the existing durable WhatsApp ingestion path.
- Query-shaped messages are handled before Phase 3 transaction parsing so unsafe query text cannot fall through into a ledger write.
- Provider-agnostic, mockable resolver interface with deterministic default resolver for CI.
- Validated intents: cash balance, income statement, expense/stock spend, and recent account transactions.
- Per-business account allowlisting before any report read; tenant scope comes from `wa_from` onboarding, not message content.
- Replies render only figures returned by Phase 4 `ReportsService`; resolver output never contains final financial numbers.
- Prompt-injection containment for cross-tenant, induced-write, scope-widening, and fabricated-number attempts.
- Unit and Testcontainers integration coverage added.

## Constitution Hardening Delivered

- Phase 3 no longer posts parsed WhatsApp transaction text immediately.
- Parsed transaction text creates a durable `transaction_proposals` row and asks the trader to reply YES/NO.
- Only a later explicit confirmation from the same `wa_from`-resolved business calls `LedgerService.postTransaction`.
- Raw HTTP report routes are disabled by default so production report reads do not accept untrusted caller-selected tenant ids.
- Referenced account code/type/business classification cannot be changed after entries exist, preserving historical report meaning.
- Reversal relationships are DB-enforced as posted, mirrored, same-business, same-currency pairs with the original marked `REVERSED` at commit.
- Every stored instant uses `timestamptz`; money currencies/scales come from an explicit registry and never use float arithmetic.

## Independent Review Remediation Delivered

- PostgreSQL plus the canonical migration catalog is now the only runtime
  database path; memory/unknown modes fail before application construction.
- Account business, code, and type are immutable from creation, closing the
  first-reference race rather than checking whether an entry is visible.
- Exact signed webhook bytes are stored before JSON parsing; strict schema
  failures become terminal quarantines and delivery rows are replay authority.
- Durable insertion is serialized per sender before sequence assignment, so a
  later confirmation cannot pass an uncommitted earlier proposal.
- Resolver clarification uses enums and application-owned templates; unexpected
  or numeric free-form fields fail closed.
- The production module graph excludes the development write controller, and
  startup rejects developer tools, insecure cookies, incomplete WhatsApp
  credentials, and every non-Postgres database mode.
- Reports cap local periods at 366 days, limits at 200, and offsets at 10,000;
  query parsing rejects scientific, fractional, infinite, or malformed values.
- Anomaly timestamps are explicitly UTC, money floors come from the selected
  supported-currency DB row, and stale post-dispatch ambiguity is terminalized
  without resending.
- Transaction sources/hashes and every currency-bearing table are constrained
  at the database boundary; logging no longer exposes phone fragments or raw
  migration exceptions.
- Inbound claims use random fencing tokens, separate renewable lease expiry, compare-and-set finalization/failure, and per-sender ingest ordering.
- Authenticated malformed webhook deliveries preserve exact raw bytes in terminal quarantine state; production outbound WhatsApp configuration fails closed.
- Proposal confirmation/cancellation is serialized per business and uses compare-and-set state transitions.
- Ambiguous anomaly sends become terminal `DELIVERY_UNCERTAIN`; the same anomaly is never automatically sent twice.
- Rate-limit state is shared in Postgres, hashed, expiring, and bounded in the development fallback.
- Readiness cannot be green without DB access, current migrations, a fresh successful recovery cycle, queryable queue state, and a non-draining process.
- Raw exception/provider content is absent from logs, DLQ output, and failure columns; bounded codes are used instead.

## Phase 6 Delivered

- `AnalyticsModule` and `AnalyticsService` for chart-ready data DTOs only.
- Cash balance over time, income vs expenses per day/week/month, and spend-by-account breakdowns.
- All analytics methods run inside `SET TRANSACTION READ ONLY` and use SELECT-only queries.
- Series are derived live from ledger `POSTED` and `REVERSED` rows; pending proposals and transient transaction states are excluded.
- Reversals net by including the `REVERSED` original and the posted reversal transaction.
- Money remains bigint-compatible minor-unit strings with formatting only at the DTO boundary.
- Buckets are generated in the requested IANA timezone and compared against UTC ledger bounds.
- New reversible read-index migration `1700000008000-AnalyticsReadIndexes`.
- Unit tests and a Testcontainers integration test added for Phase 6 behavior.

## Phase 7 Delivered

- `AnomalyModule` and `AnomalyService` for deterministic read-side anomaly detection and proactive alert dispatch.
- Pure rule functions for unusually large expenses, sales spike/drop, and activity gaps.
- Detection reuses Phase 6 daily income-vs-expenses analytics for rolling baselines and uses a read-only single-expense candidate query where Phase 6 has no per-transaction series.
- Detection figures come from posted ledger history with reversals netted and pending/non-posted rows excluded.
- Alert dispatch reuses the existing provider-agnostic `WhatsAppClient`.
- New `anomaly_alerts` notification metadata table provides idempotent one-alert-per-anomaly behavior without mutating ledger data.
- Thresholds are provisional and intentionally logged as technical debt for validation/tuning against real transaction volume.
- Absolute floors are loaded read-only from the supported-currency registry for
  ZAR, USD, JPY, or BHD; unsupported currencies fail at the database boundary.
- Started but unresolved sends are reconciled to terminal
  `DELIVERY_UNCERTAIN` without an automatic provider resend.
- Unit tests and a Testcontainers integration test added for Phase 7 behavior.

## Phase 8 Delivered

- `DashboardModule` exposes a read-only dashboard BFF and browser shell under `/dashboard`.
- The original Phase 8 server-side tenant stub has been removed. Dashboard routes now require Phase 9 authentication and principal-derived tenant context.
- The client cannot select `businessId`, `currency`, or `timezone`; those values come from the authenticated principal's server-side business context.
- Dashboard endpoints call existing Phase 4, Phase 6, and Phase 7 services and add no ledger-write path.
- The browser renderer formats existing read-service `MoneyDto.formatted` strings into South African trader display (`R 2 030.00`) without reading minor units, aggregating, parsing floats, or recomputing money.
- The overview now includes a plain-language headline insight, period/account/as-of filters, KPI cards, visible Sales minus Costs equals Profit reconciliation, labelled chart panels, money-movement tables, anomaly/alert panels, and responsive loading/error/empty states.
- The dashboard and login now follow the KasiCash brand sheet: `Kc` lockup, vivid green, black, warm ivory, Poppins-first typography, and the `Simple to run. Easy to grow.` tagline.
- Chart bars use server-generated non-financial percentage strings derived from bigint-compatible DTO values; the browser does not read minor units or compute financial ratios.
- Alert status metadata is read in a `SET TRANSACTION READ ONLY` transaction and scoped by the authenticated business.
- Unit tests and a Testcontainers endpoint integration test cover Phase 8 read-only behavior, authenticated tenant isolation, DTO rendering, empty-state handling, no client-side money parsing, reversal netting, pending-proposal exclusion, and other-tenant exclusion.
- The browser website path now includes `GET /auth/login`, which posts to the
  existing session API, relies on the existing HttpOnly cookie, and redirects to
  `/dashboard` without storing bearer tokens in browser storage.
- The public marketing page now routes new users to `GET /auth/signup`, a
  setup-request page that does not create tenants, sessions, or ledger entries;
  existing users still sign in at `GET /auth/login`.
- Deployment scaffolding now includes `Dockerfile`, `.dockerignore`,
  `DEPLOYMENT_DASHBOARD.md`, and an `auth:create-principal` operator script for
  creating the first dashboard principal for an existing business.
- The latest premium redesign centralizes public/auth/dashboard styling in
  `src/design-system/kasicash-design-system.ts`, adds complete static public
  trust/legal/support pages, and keeps every public page static and
  non-financial.
- The dashboard now includes service-query quick ranges for `1W`, `1M`, `3M`,
  and `1Y`; an all-time selector is intentionally deferred until the backend can
  expose a bounded earliest-record range without violating the 366-day cap.

## Phase 9 Delivered

- `AuthModule` adds opaque server-side sessions over email/password login, with per-password salted `scrypt` hashes and hashed session-token storage.
- `/auth/login`, `/auth/me`, and `/auth/logout` support bearer-token API clients and HttpOnly SameSite browser cookies.
- `AuthGuard` loads the principal from Postgres and binds every authenticated request to exactly one `businessId`, `currency`, and `timezone`.
- Phase 8 dashboard tenant stub is replaced by principal-derived server-side tenant context marked `PHASE_9_AUTHENTICATED_PRINCIPAL`.
- `/reports/*` routes are protected by `AuthGuard` and ignore caller-supplied tenant/currency/timezone fields.
- WhatsApp webhook HMAC verification remains raw-body based and is hardened with rate limiting, raw-body size limits, and replay markers written only after successful ingestion.
- Dev simulation endpoint now requires `KASICASH_DEV_TOOLS=true` plus `KASICASH_DEV_TOOLS_TOKEN` and is rate limited.
- New reversible migration `1700000010000-SecurityAuth` adds `auth_principals`, `auth_sessions`, and `webhook_replay_events`.
- Phase 9 unit coverage proves credential failures, expired/revoked/invalid session failures, tenant-bound controllers, rate limiting, replay hashing, and secure cookie construction.
- Dashboard/report integration coverage is updated to seed real principals, login, and verify authenticated tenant isolation against real PostgreSQL when Testcontainers is available.

## Phase 10 Delivered

- `ObservabilityModule` adds request correlation IDs, sanitized structured telemetry, in-process Prometheus-style metrics, liveness/readiness endpoints, graceful shutdown coordination, and a tenant-scoped operator dead-letter metadata endpoint.
- Health and readiness report real dependency state: DB connectivity, pending migrations, recovery worker status, recovery queue counts, and shutdown drain state.
- Metrics cover HTTP traffic/latency, ingestion stored/duplicate/processing outcomes, recovery cycles, recovery queue depth, report latency, auth failures, and shutdown draining without tenant IDs, private content, or money values.
- Ingestion and recovery now respect graceful shutdown: once draining begins, new claims are skipped, while in-flight message processing is tracked and allowed to finish.
- Dead-letter surfacing is authenticated with Phase 9 `AuthGuard`, scoped to the principal's `business_id`, and returns metadata only: no raw payload, message text, phone number, or money.
- `RUNBOOK.md` documents healthy/unhealthy signals plus controlled one-row dead-letter requeue guidance through existing ingestion metadata.
- Phase 10 adds no database migration, no ledger write path, and no derived financial aggregate state.
- Phase 10 unit coverage proves telemetry sanitization, correlation propagation, metrics normalization, health/readiness unhealthy cases, graceful shutdown behavior, and shutdown-aware ingestion claims.
- Phase 10 Testcontainers coverage was added for `/health`, `/ready`, and `/ops/dead-letter` against real migrated PostgreSQL; local execution is blocked by the missing Docker/Testcontainers runtime.
