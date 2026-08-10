# Changelog

## [Unreleased]

- Closed TD-3 locally by hardening and exercising the WhatsApp Cloud API outbound
  send path behind the existing `WhatsAppClient` abstraction.
- Added version-pinned Graph API endpoint construction, documented text-message
  request shape, bearer auth, bounded send timeouts, accepted `wamid.*` response
  validation, and deterministic retryable/permanent send failure classification.
- Sanitized outbound provider failures so thrown/loggable data contains only
  bounded status/code/type metadata, never tokens, phone numbers, message bodies,
  or raw provider response text.
- Preserved best-effort reply semantics: inbound messages are still marked
  `PROCESSED` before sending, and send failures do not requeue ingestion or
  repeat ledger/parsing work.
- Added unit coverage plus a local mock HTTP integration test for Cloud API
  request correctness and error handling; CI continues to make no live Meta
  calls.
- Documented manual sandbox verification for a real Cloud API send and kept
  delivery-status persistence deferred as TD-5 pending outbound message-id
  storage.
- Tuned the default best-effort WhatsApp send timeout from 10 seconds to 5
  seconds after independent review, preserving the 1-30 second override range.

- Remediated independent-review Round 3 findings with staged legacy-integrity
  preflight/gating, immutable digest-bound proposals, atomic proposal-plus-ledger
  confirmation, and a deferred database match constraint.
- Unified webhook transport/policy limits and durably quarantined authenticated
  over-policy bodies; moved rate-limit and replay expiry entirely to the
  PostgreSQL clock.
- Added downgrade refusal for unresolved `DELIVERY_UNCERTAIN` alerts and numeric
  balance aggregates that cannot overflow when valid bigint entries sum beyond
  signed bigint.
- Strictly rejected malformed dashboard pagination and hostile resolver object
  shapes, including proxies, accessors, inherited/symbol/hidden fields, and
  unsafe numbers.
- Added Round 3 adversarial unit and PostgreSQL fixtures for legacy upgrades,
  proposal mutation/linkage/atomicity, >1 MiB webhook bodies, clock skew,
  downgrade ambiguity, and aggregate totals above bigint.

- Closed independent-review round-two findings: removed the production `pg-mem`
  path and dependency, made PostgreSQL plus canonical migrations mandatory, and
  moved production configuration rejection ahead of Nest/TypeORM construction.
- Added migration `1700000015000-RoundTwoIntegrityHardening` for unconditional
  account classification immutability, one database currency registry across
  all currency-bearing tables, per-currency bigint anomaly floors, and strict
  source provenance constraints.
- Changed the WhatsApp HTTP boundary to preserve HMAC-authenticated raw bytes
  before JSON parsing, strictly validate the callback schema, quarantine every
  parse/schema failure terminally, and use durable deliveries as replay truth.
- Serialized same-sender insertion with a PostgreSQL transaction advisory lock,
  removed free-form resolver clarification prose, omitted the dev controller in
  production, and bounded direct report periods/pagination.
- Added terminal alert-send reconciliation without provider resend, explicit UTC
  anomaly timestamps, privacy-safe development/migration logs, fail-closed CI
  migration inspection, and executable repository text-hygiene verification.
- Added round-two regression coverage for production configuration, raw webhook
  HTTP behavior, sender/account concurrency, malicious resolver output, report
  bounds, currency/provenance constraints, non-UTC anomalies, and ambiguous
  alert dispatch.
- Remediated the independent full-system review: referenced account code/type/business classification is DB-frozen, reversals are tenant- and currency-consistent in both directions, and the supported currency registry is explicit.
- Added migrations `1700000011000` through `1700000014000` for ledger/reversal integrity, `timestamptz` instants, fenced ordered ingestion with durable authenticated webhook deliveries, at-most-once alert dispatch state, privacy-safe error codes, and shared Postgres rate limits.
- Added a canonical application/test entity and migration catalog so production boot, migration CLI, and all Testcontainers suites cannot drift.
- Added sender-order and lease fencing, proposal compare-and-set/advisory locking, tenant-scoped reversal lookup, expired replay refresh, dashboard range/pagination bounds, auth timing equalization, production cookie/WhatsApp fail-closed configuration, and truthful recovery freshness readiness.
- Removed raw provider/processing errors from persistence and operator output; telemetry now allowlists safe fields and omits secrets, PII, private text, and money.
- Added adversarial unit and Testcontainers coverage for classification immutability, orphan/cross-currency reversal rejection, stale-worker fencing, forced sender reordering, signed malformed delivery quarantine, non-UTC database sessions, shared rate limits, replay refresh, and full migration run/revert/rerun.
- Updated production and development dependency trees to zero known npm audit vulnerabilities and added an audit gate to CI.
- Added repository LF policy plus CI whitespace checking so generated lockfile line endings cannot silently regress.

- Phase 10 Observability & Hardening: added sanitized structured telemetry, request correlation IDs, in-process metrics, health/readiness endpoints, graceful shutdown coordination, and authenticated operator DLQ metadata.
- Added `PHASE10_OBSERVABILITY_HARDENING_DESIGN.md` documenting telemetry rules, metrics, health/readiness checks, shutdown behavior, and deferred observability infrastructure.
- Added `RUNBOOK.md` with production signal interpretation and controlled dead-letter inspection/replay guidance.
- Added Phase 10 unit tests for sanitization, correlation, metrics, health/readiness unhealthy cases, graceful shutdown, and ingestion shutdown claim behavior.
- Added a Testcontainers observability integration test that hits `/health`, `/ready`, and tenant-scoped `/ops/dead-letter` against a migrated PostgreSQL database.
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
- Phase 6 Visual Analytics: added `AnalyticsModule` and read-only `AnalyticsService` methods for cash balance time series, income-vs-expenses buckets, and spend-by-account breakdowns.
- Added `PHASE6_ANALYTICS_DESIGN.md` documenting bucketing SQL, reversal netting, DTO shape, timezone handling, and the no-pre-aggregation decision.
- Added reversible migration `1700000008000-AnalyticsReadIndexes` with read indexes only; no analytics cache or materialized financial state.
- Added Phase 6 unit tests for read-only transactions, tenant/status filters, timezone bucket parameters, bigint money mapping, and rollback behavior.
- Added a Testcontainers analytics integration test that seeds real ledger transactions, reverses one through `LedgerService`, and verifies series values, tenant isolation, pending-proposal exclusion, and Africa/Johannesburg bucket bounds.
- Phase 7 Anomaly Detection & Proactive Alerts: added `AnomalyModule`, deterministic pure anomaly rules, read-only detection service, and idempotent WhatsApp alert dispatch.
- Added `PHASE7_ANOMALY_ALERTS_DESIGN.md` documenting provisional thresholds, baseline windows, reversal handling, tenant scoping, alert keys, and fail-safe behavior.
- Added migration `1700000009000-AnomalyAlerts` for non-financial alert idempotency/delivery metadata.
- Exported the existing `WHATSAPP_CLIENT` provider from `IngestionModule` so alert dispatch reuses the outbound abstraction.
- Added Phase 7 unit tests for large expense, sales spike/drop, activity gap, boundary conditions, reversal-netted daily values, read-only detection SQL, no ledger mutation on dispatch, and alert idempotency.
- Added a Testcontainers anomaly integration test that seeds posted history, a real `LedgerService` reversal, other-tenant noise, pending proposal noise, and verifies anomalies, figures, and one-send alert behavior against real PostgreSQL.
- Phase 8 Web Dashboard: added a guarded read-only `/dashboard` BFF and dependency-free browser dashboard over Phase 4 reports, Phase 6 analytics, and Phase 7 anomaly/alert data.
- Added `PHASE8_DASHBOARD_DESIGN.md` documenting endpoint contracts, service mappings, server-side tenant stub, DTO reuse, and front-end rendering boundaries.
- Added explicit Phase 8 dashboard environment guard (`KASICASH_DASHBOARD_ENABLED` plus `KASICASH_DASHBOARD_BUSINESS_ID`) so unauthenticated dashboard routes are not production-exposed by default.
- Added dashboard unit tests for server-side tenant scoping, read-only alert metadata access, and front-end rendering from formatted DTO money strings without client-side money parsing.
- Added a Testcontainers dashboard integration test that hits `/dashboard/api/overview` and verifies report/analytics figures, reversal netting, pending proposal exclusion, alert metadata scoping, and client-supplied tenant override containment against real PostgreSQL.
- Phase 9 Security & Auth: added opaque server-side sessions, `AuthModule`, `AuthGuard`, `/auth/login`, `/auth/me`, and `/auth/logout`.
- Replaced the Phase 8 dashboard tenant stub with authenticated principal-derived tenant context and protected `/reports/*` routes with the same server-side authorization.
- Added migration `1700000010000-SecurityAuth` for principals, hashed sessions, and webhook replay markers.
- Hardened WhatsApp webhook and dev simulation endpoints with rate limiting, raw-body size checks, replay suppression, and explicit dev token protection.
- Added Phase 9 unit tests for password hashing, login/session validation, cookie/bearer guard behavior, rate limiting, webhook replay hashing, and tenant-scoped controllers.
- Updated the dashboard/report Testcontainers integration test to login real principals and prove cross-tenant reads fail or stay bound to the authenticated business.
