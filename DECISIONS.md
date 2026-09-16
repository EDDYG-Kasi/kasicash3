# Architecture Decision Records

## ADR 24: Dashboard website uses existing session auth and container deployment

- **Date**: 2026-08-10
- **Context**: The Phase 8 dashboard existed as a browser route, but a real website needs a browser login page, a deployable server shape, and an operator-safe way to create the first dashboard principal for an existing business.
- **Login decision**: `GET /auth/login` serves a small browser login page that posts to the existing `POST /auth/login` endpoint. The existing AuthService still creates the session, the existing controller still sets the HttpOnly cookie, and the page redirects to `/dashboard` without storing bearer tokens in local or session storage.
- **Deployment decision**: Add a standard Docker production image and deployment guide for Node/container hosts backed by managed PostgreSQL. GitHub Pages is explicitly not a real deployment target because it cannot run NestJS, PostgreSQL migrations, server-side auth, or tenant enforcement.
- **Operator decision**: Add `npm run auth:create-principal` to create an auth principal for an existing `businesses.id`. This writes only auth metadata and never writes ledger transactions, entries, reports, analytics, or balances.
- **Boundary decision**: The dashboard remains read-only and tenant-scoped from the authenticated principal. Deployment scaffolding does not relax production runtime validation, WhatsApp Cloud fail-closed config, secure cookie requirements, or any ledger invariant.
- **Consequences**: KasiCash now has a usable browser website path (`/auth/login` to `/dashboard`) and a deployable container shape. Actual hosting still requires managed PostgreSQL, secret configuration, migrations, and a green CI run.

## ADR 23: WhatsApp Cloud outbound is version-pinned, sanitized, and best-effort

- **Date**: 2026-08-10
- **Context**: TD-3 identified that the live WhatsApp Cloud API send path had not been exercised end-to-end. The existing provider-agnostic `WhatsAppClient` boundary and best-effort ingestion reply semantics must remain unchanged, and no provider failure can re-trigger ledger or inbound processing.
- **Provider decision**: `CloudApiWhatsAppClient` now builds a versioned Graph API request to `/{WHATSAPP_GRAPH_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`, defaults to pinned `v24.0`, sends bearer auth only in the header, includes the documented text-message request shape, bounds network timeouts, and validates accepted `wamid.*` responses.
- **Failure decision**: Provider and transport failures become `WhatsAppDeliveryError` values with deterministic retryable/permanent classification. Thrown/loggable content is sanitized to status/code/type only; access tokens, full phone numbers, message bodies, and raw provider error bodies are never logged.
- **Best-effort decision**: Ingestion still writes `PROCESSED` before sending. A send failure logs a sanitized error code and does not move the row back to `FAILED`, does not requeue the inbound message, and does not repeat parsing, onboarding, or ledger confirmation.
- **Verification decision**: CI uses fetch stubs plus a local mock HTTP server and never calls Meta. Real Cloud API verification is a documented manual sandbox procedure only.
- **Deferred decision**: Delivery-status callbacks (`sent`, `delivered`, `read`, `failed`) remain TD-5 until outbound provider message ids and attempts are persisted in a dedicated non-financial table. This avoids a partial status store that cannot reconcile callbacks safely.
- **Consequences**: TD-3 is closed locally with build, unit, and mock HTTP integration coverage. A real sandbox send still needs operator-run evidence outside CI, and TD-5 remains open.

## ADR 22: Round-three integrity is staged, digest-bound, and single-transaction

- **Date**: 2026-08-03
- **Context**: Round 3 found unsafe legacy constraint installation, mutable proposal facts and a nested confirmation transaction, webhook transport/policy drift, mixed clocks, ambiguous alert downgrade, coercive input parsing, hostile resolver objects, and balance aggregate overflow.
- **Upgrade decision**: A preflight migration performs only reversible semantics-preserving canonicalization and emits bounded category counts. A separate gate blocks ambiguous rows before stricter constraints. Migrations execute one transaction at a time so diagnostics remain available after the gate fails.
- **Confirmation decision**: PostgreSQL generates a digest over proposal facts and freezes them after insert. The prompt exposes a short digest reference. Confirmation row-locks the exact pending proposal and posts through the same active `EntityManager`; a deferred trigger validates the complete proposal-to-transaction economic/provenance mapping at commit.
- **Boundary decision**: One helper defines webhook policy and absolute transport ceilings. Valid HMAC bodies rejected by policy are durably quarantined. PostgreSQL alone calculates shared rate/replay expiry. Dashboard integers and resolver objects are strictly canonicalized without coercion or accessor execution.
- **Safety decision**: Aggregate balance totals use `numeric` while individual money columns remain bigint. Downgrade refuses unresolved ambiguous alert deliveries.
- **Consequences**: Unit/build/lint evidence is green locally. Real PostgreSQL execution and immutable green CI remain mandatory before production readiness.

## ADR 21: Round-two review hardening removes alternate production semantics

- **Date**: 2026-08-03
- **Context**: Independent review reproduced a production boot against a synchronized in-memory database, first-entry account reclassification and sender-order races, malformed webhook loss before persistence, model-authored clarification figures, and several fail-closed/operability gaps.
- **Runtime decision**: The application has one database mode: PostgreSQL with `synchronize: false` and the canonical entity/migration catalog. Runtime configuration is validated before Nest construction. Production omits the synthetic ingestion controller and rejects developer tools, insecure cookies, non-cloud WhatsApp delivery, or incomplete webhook/provider credentials.
- **Ledger decision**: Account `business_id`, `code`, and `type` are immutable from creation. The database uses one supported-currency table across transactions, proposals, principals, and alerts. External provenance has an allowlisted source and exact lowercase SHA-256 hash.
- **Ingestion decision**: The route receives raw bytes, verifies their HMAC, stores them, then parses and strictly validates. Invalid JSON/schema is a durable terminal quarantine. Same-sender advisory locking spans insertion and monotonic sequence assignment.
- **Read/AI decision**: Clarification output is an enum rendered by application-owned templates; report ranges and pagination are bounded in the shared service; anomaly instants are explicit UTC and absolute thresholds come from currency registry rows.
- **Outbound decision**: Once alert dispatch starts, it is never automatically retried. A reconciliation worker terminalizes stale started sends as `DELIVERY_UNCERTAIN` without contacting the provider.
- **Consequences**: The known round-two Critical/High implementation paths are closed and 172 unit tests pass locally. Production readiness still requires a green PostgreSQL 15 Testcontainers/CI run and migration round trip because this workstation has no container runtime.

## ADR 20: Independent-review remediation is database-first and fail-closed

- **Date**: 2026-08-02
- **Context**: The full-system review found mutable historical account classification, incomplete reversal relationships, unfenced ingestion leases, sender-order races, ambiguous alert retries, process-local rate limits, timezone-ambiguous storage, implicit currency scales, unsafe error persistence, and readiness checks that could report green without a fresh recovery cycle.
- **Decision**: Add only new reversible migrations and keep one canonical runtime/test migration catalog. Freeze referenced account classification in PostgreSQL; enforce both sides of reversal integrity including currency; convert instants to `timestamptz`; add claim tokens, independent lease expiry, monotonic sender sequence, exact authenticated webhook delivery storage, privacy-safe error codes, alert dispatch point-of-no-return state, and shared hashed Postgres rate-limit windows.
- **Application behavior**: Reversal lookup is tenant-scoped. Proposal transitions use a per-business advisory transaction lock and compare-and-set updates. Ingestion finalization/failure/heartbeat updates require the current claim token. A later sender message cannot claim while an earlier non-terminal message remains. Production WhatsApp delivery fails startup unless cloud mode and credentials are explicit.
- **Read side**: Supported currencies and minor-unit scales are explicit (`ZAR`/`USD` 2, `JPY` 0, `BHD` 3). Report and analytics time bounds are independent of the database session timezone. Dashboard periods and offsets are bounded.
- **Operations and security**: Readiness requires a successful recent recovery cycle and catches DB, migration, and queue-inspection failures without leaking details. Authentication performs password work for unknown accounts, production rejects insecure cookies, replay rows refresh after expiry, and telemetry/DLQ surfaces expose codes rather than raw provider or financial content.
- **Consequences**: Financial and recovery guarantees are now enforced below normal application paths and have adversarial unit/Testcontainers coverage. Round-two follow-up is recorded in ADR 21. The local machine has no Docker/WSL/Postgres runtime, so real-Postgres execution remains pending green CI.

## ADR 19: Phase 10 observability is additive, sanitized, and non-financial

- **Date**: 2026-08-02
- **Context**: The final phase must make KasiCash operable in production without changing ledger behavior, tenant authorization, confirm-then-post, AI boundaries, bigint money, webhook idempotency, or recovery guarantees.
- **Decision**: Add a global `ObservabilityModule` with request correlation IDs, sanitized structured logs, in-process metrics, `/health`, `/ready`, `/metrics`, and an authenticated `/ops/dead-letter` metadata surface. Telemetry observes existing paths and does not call ledger writers or alter report/analytics/anomaly math.
- **Sanitization**: Telemetry redacts secrets and omits raw payloads, message text, phone numbers, emails, money fields, formatted figures, and bigint values. Metric labels are low-cardinality and exclude tenant IDs, account IDs, private text, and money.
- **Health**: Liveness reports process/draining state. Readiness requires DB connectivity, no pending migrations, a successful recent recovery cycle, queryable recovery state, and no graceful shutdown drain. Recovery queue counts expose operational backlog rather than hiding it.
- **Graceful shutdown**: Shutdown marks the app as draining, prevents new ingestion claims, and waits for in-flight processing. This preserves the existing atomic claim and lease-based recovery semantics.
- **DLQ**: Dead-letter surfacing is read-only metadata scoped by the authenticated principal's `business_id`. Controlled replay remains a runbook operation so Phase 10 does not add a broad product write surface.
- **Consequences**: Operators can see traffic, failures, queue state, readiness, and dead letters without changing financial outcomes. Distributed tracing, log aggregation, hosted dashboards/alerts, audited DLQ replay tooling, SLOs, and load testing remain deferred.

## ADR 18: Phase 9 uses opaque sessions and server-side tenant authorization

- **Date**: 2026-08-01
- **Context**: Phase 8 exposed a read-only dashboard behind a temporary server-side tenant stub. Phase 9 must make tenant isolation authenticated and authorized without weakening ledger immutability, confirm-then-post, AI boundaries, report/analytics/anomaly math, or bigint money handling.
- **Decision**: Add `AuthModule` with email/password login, salted `scrypt` password hashes, opaque random session tokens, SHA-256 token hashes in `auth_sessions`, expiry, logout revocation, bearer-token support, and HttpOnly SameSite cookies for browser clients. Unknown accounts perform the same password derivation work as wrong passwords, and production cookies cannot be configured insecurely.
- **Tenant boundary**: Each `auth_principals` row belongs to one `business_id`. `AuthGuard` validates the session, loads the principal from Postgres, and attaches the trusted `businessId`, `currency`, and `timezone`. Dashboard and report controllers use only that context and ignore client tenant/currency/timezone parameters.
- **Webhook hardening**: Existing raw-body WhatsApp HMAC verification remains mandatory. Phase 9 adds shared Postgres-backed fixed-window rate limiting, raw-body size limits, and replay markers keyed by payload hash. Expired replay markers are refreshed safely before the payload is accepted again.
- **Dev tools**: Synthetic WhatsApp ingestion stays development-only and now requires both `KASICASH_DEV_TOOLS=true` and `KASICASH_DEV_TOOLS_TOKEN`.
- **Consequences**: Phase 9 removes the Phase 8 production auth gap for dashboard/report reads. MFA, RBAC, durable security audit logs, distributed rate limiting, key-management operations, and formal penetration testing remain deferred.

## ADR 17: Phase 8 dashboard is a guarded read-only BFF over existing services

- **Date**: 2026-08-01
- **Context**: KasiCash needs a web dashboard. The constitution forbids new ledger-write paths, client-selected tenants, fabricated figures, and client-side money math. The original Phase 8 tenant stub has since been superseded by Phase 9 authentication.
- **Decision**: Phase 8 adds `DashboardModule` with guarded `/dashboard` routes. The BFF calls Phase 4 `ReportsService`, Phase 6 `AnalyticsService`, and Phase 7 `AnomalyService.detectAnomalies()`. It does not call `LedgerService` and exposes no mutation endpoints.
- **Tenant boundary**: `DashboardTenantGuard` obtains one authenticated principal-derived business context from `DashboardTenantContextService`. The client cannot supply or override `businessId`, `currency`, or `timezone`. Dashboard DTOs mark the boundary as `PHASE_9_AUTHENTICATED_PRINCIPAL` and `productionReady: true`.
- **UI decision**: The dashboard uses a dependency-free TypeScript/HTML/CSS browser shell served by NestJS. This keeps Phase 8 testable without adding a second build system; React or another richer client can be introduced later if it preserves the same read-only and money-formatting tests.
- **Money and rendering**: The browser renderer displays `MoneyDto.formatted` values returned by existing read DTOs. It does not aggregate money, parse money with floats, or recompute financial figures. Server-side chart-scale metadata now includes display-ready percentage strings for non-financial bar widths.
- **Alerts**: Dashboard alert status reads use `SET TRANSACTION READ ONLY` against `anomaly_alerts` and remain scoped to the configured business. Alert metadata is not financial truth.
- **Consequences**: Phase 8 gives a polished read-only dashboard without weakening ledger boundaries. Dashboard write actions, real-time updates, i18n, formal accessibility audit, and richer charting remain deferred.

## ADR 16: Phase 7 anomalies are deterministic read-side detections with idempotent notification metadata

- **Date**: 2026-07-30
- **Context**: KasiCash needs proactive alerts, but alerts must not become financial records or black-box assertions. Detection must stay traceable to posted ledger history and must fail safe when baseline evidence is thin.
- **Decision**: Phase 7 adds `AnomalyModule` and `AnomalyService`. Detection reuses Phase 6 daily income-vs-expenses analytics for rolling baselines and uses one narrow read-only SELECT for active posted single-expense transaction candidates. Detection methods do not write the ledger or any financial table.
- **Rules**: Initial rules are deterministic: large active posted expense at least 3x recent active expense baseline and above the selected currency's DB-configured floor; daily sales at least 2x or at most 50% of a 14-day rolling baseline with currency-specific baseline/delta floors; and no sales for 3 days after a normally active baseline. These thresholds are provisional and must be validated/tuned against real transaction volume.
- **Ledger semantics**: Figures come from `POSTED`/`REVERSED` ledger-derived data with reversals netted and non-posted/proposed rows excluded. Large-expense candidates require `POSTED` and no `reversal_of_transaction_id` so already reversed originals and reversal rows do not trigger a single-expense alert.
- **Alerts**: Dispatch writes only `anomaly_alerts` notification metadata. The unique `(business_id, anomaly_key)` key prevents repeat alerts. Claims may be recovered only before external dispatch begins; once send begins, a failure/crash is recorded as `DELIVERY_UNCERTAIN` and never retried automatically, preventing duplicate alerts at the cost of operator reconciliation.
- **Outbound**: Alert delivery reuses the existing provider-agnostic `WhatsAppClient`. The recipient is `businesses.wa_phone` from trusted business context, never message text.
- **Consequences**: Phase 7 can notify traders without mutating ledger state or inventing numbers. Provider-level outbound idempotency, scheduling, preferences/opt-out, ML assistance, and per-business thresholds remain deferred.

## ADR 15: Phase 6 analytics are live read-only ledger series

- **Date**: 2026-07-30
- **Context**: Visual analytics need chart-ready time-series data without weakening the ledger, drifting from Phase 4 report semantics, or letting a future dashboard become a financial source of truth.
- **Decision**: Phase 6 adds `AnalyticsModule` and `AnalyticsService` as read-only live aggregations over the same posted ledger history Phase 4 reads. Each method starts a transaction, executes `SET TRANSACTION READ ONLY`, then runs SELECT-only SQL against `transactions`, `entries`, and `accounts`.
- **Series**: The service returns cash balance over time, income vs expenses by day/week/month, and spend-by-account breakdowns. It returns DTO data only, not rendered charts.
- **Ledger semantics**: Analytics include `POSTED` and `REVERSED` transaction rows so a reversed original and its posted reversal net correctly. They exclude `POSTING`, pending proposals, and any unposted state.
- **Money and time**: Amounts remain bigint-compatible minor-unit strings until `toMoneyDto` formats them at the DTO boundary. Buckets are generated in the caller's IANA timezone and converted to UTC ledger bounds using the existing Phase 4 period helper.
- **Indexes**: Migration `1700000008000-AnalyticsReadIndexes` adds only reversible read indexes. It creates no materialized aggregates or cached financial state.
- **Consequences**: Analytics stay traceable and constitution-safe. Very large ledgers may need rebuildable materialized projections later, but Phase 6 deliberately prioritizes correctness over premature dashboard caching.

## ADR 13: Phase 3 parsed transactions require explicit confirmation

- **Date**: 2026-07-30
- **Context**: The engineering constitution requires AI/parsing to propose and a human to confirm before any ledger write. The earlier parser posted recognized WhatsApp transaction text immediately, which made the parser a ledger-write trigger instead of a proposal producer.
- **Decision**: Parsed WhatsApp transaction text now creates a durable `transaction_proposals` row with status `PENDING`. A later explicit confirmation message (`YES`, `confirm`, etc.) from the same `wa_from`-resolved business is required before `LedgerService.postTransaction` is called. Cancellation messages mark the pending proposal `CANCELLED`.
- **Idempotency**: The proposal source message is unique per business, and the ledger post uses `proposal:{proposal_id}` as its idempotency key. If a confirmation retry races or repeats after posting, the proposal's confirmed message id and transaction id make the response idempotent without creating another transaction.
- **Tenant scope**: Confirmation lookup is by server-resolved `business_id`; message content cannot confirm or post a proposal for another tenant.
- **Consequences**: One-message auto-posting is intentionally removed. This costs one extra WhatsApp turn but restores the legal-record boundary: parser proposes, user confirms, trusted ledger code posts.

## ADR 14: Raw HTTP report routes are disabled by default

- **Date**: 2026-07-30
- **Context**: `ReportsService` is correctly tenant-scoped and read-only, but exposing report controllers that accept a caller-supplied `businessId` is not trusted server-side tenant context. The production product is WhatsApp-driven; Phase 5 obtains tenant identity from `wa_from`.
- **Decision**: The `/reports/*` controller is disabled unless `KASICASH_REPORT_ROUTES=true` is set deliberately for controlled environments. Phase 5 continues to use `ReportsService` internally with the business id resolved from WhatsApp onboarding.
- **Consequences**: Direct report URLs are no longer a default supported production surface. Auth-bound report APIs remain deferred work.

## ADR 11: Phase 4 reports are read-only ledger aggregations

- **Date**: 2026-07-29
- **Context**: Core reports must summarize cash, income/expense, and account history without weakening the immutable ledger. The ledger is the single legal record; report figures must be traceable to posted entries and must not drift from cached/materialized state.
- **Decision**: Phase 4 reports are pure read-only aggregations over `accounts`, `entries`, and `transactions`. `ReportsService` runs every report inside a database transaction followed by `SET TRANSACTION READ ONLY`, then uses SELECT-only SQL through a `QueryRunner`. Reports include legal posted-history rows with status `POSTED` or `REVERSED`, and exclude transient/unconfirmed states such as `POSTING` or any future `PROPOSED` state. This is required because a reversal leaves the original row as `REVERSED` and creates a posted reversing transaction; including both makes balances net to zero.
- **Money**: All amounts remain integer minor-unit strings. Formatting uses `BigInt` arithmetic only; no floats.
- **Tenant scope**: Every report query filters by one `business_id`. Account statements first verify the requested account belongs to that business.
- **Timezone**: Callers pass an IANA timezone, defaulting to `Africa/Johannesburg` until businesses store timezone preferences. Local date ranges are converted to UTC bounds by the service.
- **Indexes**: Migration `1700000006000-ReportReadIndexes` adds read indexes only. No prior ledger migration or invariant is modified.
- **Consequences**: Reports are deterministic and traceable, but Phase 4 does not support cached dashboards, auth-bound access control, custom report types, or persisted per-business timezone settings. Those are deferred.

## ADR 12: Phase 5 conversational queries resolve intent, never figures

- **Date**: 2026-07-29
- **Context**: Traders need to ask financial questions over WhatsApp, but free-text input is untrusted and must not bypass the immutable ledger or tenant boundaries. AI may help resolve intent, but it must not compute or invent financial facts.
- **Decision**: Phase 5 adds a `ConversationalQueryModule` inside the existing durable ingestion path. Query-shaped inbound text is routed before Phase 3 parsing, resolved behind a mockable `CONVERSATIONAL_QUERY_RESOLVER` provider, validated against a per-business account allowlist, then answered only through Phase 4 `ReportsService` methods.
- **Read-only guarantee**: The conversational query service imports no ledger writer service and calls no transaction creation APIs. It reads only the current business's accounts for validation, then calls read-only report methods.
- **AI boundary**: Resolver output is treated as a proposal of `kind`, period, account hint, currency, and limit. The resolver may not provide tenant ids, account ids for another business, SQL, mutations, or final numbers. Replies render amounts only from report DTOs.
- **Tenant scope**: `businessId` comes only from onboarding via `wa_from`. Message content cannot choose a tenant.
- **Safety**: Prompt-injection-shaped query text is contained as out of scope and never falls through to Phase 3 transaction posting.
- **Consequences**: The first implementation is deliberately narrow: cash, sales/expenses over a period, expense/stock spend, and recent account transactions. Multi-turn context, richer natural language, product-level analytics, and live model providers are deferred.
