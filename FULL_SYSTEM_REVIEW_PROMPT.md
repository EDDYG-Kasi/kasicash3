# KasiCash Full System Review Prompt For Claude

You are a senior backend, accounting-systems, security, and reliability engineer performing a comprehensive independent review of KasiCash after Phases 1-10. Treat this as a serious production-readiness review of a financial system, not a style pass.

Do not assume the documentation is true. Verify every claimed guarantee against code, migrations, tests, and behavior. Cite exact files and line numbers for every finding. Lead with risks and bugs, ordered by severity. If no issue exists for a category, say that clearly and name the evidence you checked.

## Product Context

KasiCash is a WhatsApp-driven financial operating system for informal South African traders. The core record is an immutable PostgreSQL double-entry ledger. Money is stored and carried as bigint minor units represented as strings. AI may help parse or resolve intent, but AI must never write the ledger and must never fabricate read-side financial figures.

Architecture: NestJS modular monolith, PostgreSQL, TypeORM. Tests use Jest and Testcontainers for real PostgreSQL integration coverage.

## Non-Negotiable Constitution Invariants

Review these as hard requirements:

1. The ledger is the only legal financial record.
2. Ledger transactions and entries are append-only and immutable after posting.
3. Corrections happen only through posted reversal transactions with mirrored entries.
4. Every committed transaction is balanced, non-empty, and moves through the allowed lifecycle.
5. Money stays integer minor units as strings end-to-end. No float money.
6. Every read and write is scoped to exactly one `business_id` from trusted server-side context.
7. Message text, model output, and client parameters may never widen tenant scope.
8. AI never writes the ledger. Parser/model output is untrusted.
9. Financial figures on read paths come only from deterministic ledger-derived code.
10. WhatsApp webhooks must be verified with HMAC over raw bytes before processing.
11. Ingestion is durable, idempotent, retryable, and recoverable. No message is silently lost.
12. Schema changes are ordered reversible migrations. Do not edit shipped migrations.
13. Read paths must not mutate financial data.
14. Telemetry must not leak secrets, PII, raw message content, or money values.

## Phase Map To Verify

Phase 1: Immutable double-entry ledger.

- Database-enforced immutability and balance.
- Tenant-consistent transaction/account/entry relationships.
- Reversal semantics and idempotency.

Phase 2: WhatsApp ingestion, onboarding, durable recovery.

- Ack-first durable inbound persistence.
- HMAC raw-body verification.
- Idempotent inbound storage by WhatsApp message ID.
- Atomic processing claim, retry/backoff, DEAD state.
- Best-effort outbound reply never corrupts processing state.

Phase 3: Natural-language transaction parsing with human confirmation.

- Parser creates transaction proposals only.
- Human YES/confirm from same server-resolved business is required before posting.
- Pending/cancelled proposals cannot affect financial reports.
- No AI or parser bypass to `LedgerService.postTransaction`.

Phase 4: Read-only core reports.

- Cash position, income statement, account statement.
- Only posted legal history included: `POSTED` and `REVERSED` rows so original plus reversal nets correctly.
- `POSTING` and pending proposal state excluded.
- Read-only transactions, tenant scope, currency scope, timezone-explicit date ranges.
- Bigint money integrity.

Phase 5: Conversational queries.

- Query text routes before transaction parsing.
- Resolver/model proposes intent only, never final figures.
- Intent validation prevents tenant/account widening and write actions.
- Replies render report-derived figures only.

Phase 6: Visual analytics.

- Read-only chart-ready DTOs only, no rendered images and no cache drift.
- Cash balance over time, income vs expenses per bucket, spend-by-account breakdown.
- Same posted-history and reversal-netting semantics as Phase 4.
- Bigint-string values, currency-aware, timezone-explicit bucketing.

Phase 7: Anomaly detection and proactive alerts.

- Deterministic rule-based detection over ledger-derived history.
- No black-box financial facts.
- Thresholds are provisional and explainable.
- Alerts are notification metadata, not financial records.
- Alert dispatch is idempotent and tenant-scoped.
- No duplicate alerts for same anomaly.

Phase 8: Web dashboard.

- Dashboard is read-only over existing P4/P6/P7 read services.
- No new ledger-write path.
- Server-side tenant scoping, no client-selected tenant.
- Client displays formatted DTO money only, no client-side money recomputation.

Phase 9: Security and auth.

- Real authenticated principal-to-business enforcement replaces Phase 8 stub.
- One principal can access only its own business by every route.
- Tokens/passwords are handled securely and never logged.
- Webhook hardening adds rate limiting/replay protection without breaking ack-first idempotency.

Phase 10: Observability and hardening.

- Observability is additive and does not alter financial behavior.
- Structured logs, metrics, correlation, health/readiness, graceful shutdown, and DLQ metadata.
- No secrets, PII, raw payloads, message text, phone numbers, emails, money, or formatted figures in telemetry.
- Health/readiness reflect real DB, migration, recovery, and shutdown state.
- Graceful shutdown respects atomic claims and does not drop or double-process messages.

## Review Procedure

1. Receipt-check the attached files and say which expected files are missing.
2. Read `ENGINEERING_CONSTITUTION.md` first and use it as the standard.
3. Read the design/status docs next, but treat them as claims to verify.
4. Inspect migrations in order and verify schema invariants and reversibility.
5. Inspect each module implementation and tests for Phases 1-10.
6. Run or mentally validate the commands below. If you cannot run them, say why.
7. Produce findings first, ordered by severity, with exact file/line references.
8. Include a "Constitution Compliance Matrix" with pass/fail/uncertain for each invariant.
9. Include "Missing Tests / CI Gaps".
10. Give an overall production-readiness verdict for the full system.

## Commands To Run

```bash
npm ci
npm run lint
npm run build
npm test -- --runInBand
npm run test:integration
git diff --check -- . ':!package-lock.json'
```

If Testcontainers cannot start, report that integration proof is blocked by local Docker/container runtime and must be verified in CI.

## High-Risk Areas To Hunt

- Any direct ledger write path outside `LedgerService` and confirm-then-post.
- Any parser/model/conversational/dashboard/anomaly path that can call a ledger writer.
- Any report, analytics, anomaly, dashboard, or observability query that accepts a caller-supplied tenant and can read another business.
- Any money parsed or computed with `number`, `parseFloat`, division on floats, or JavaScript floating point.
- Any report/analytics logic that excludes `REVERSED` originals and therefore fails to net reversals correctly.
- Any non-posted or pending proposal state included in read-side figures.
- Any mutation inside read-only report/analytics/anomaly/dashboard/observability code.
- Any endpoint left unauthenticated after Phase 9 that exposes business data.
- Any secret/session token/password/webhook signature/raw message text/phone/email/money in logs, metrics, traces, or operator endpoints.
- Any health endpoint that returns ready when DB is down, migrations are pending, recovery is disabled, or shutdown is draining.
- Any shutdown path that can abandon a claimed message without lease recovery or start new claims while draining.
- Any migration that edits prior migrations, lacks a `down()`, or weakens DB invariants.
- Any test that asserts mocked behavior only where the constitution requires real PostgreSQL proof.

## Expected Review Output

Use this structure:

1. Receipt Check
2. Executive Verdict
3. Critical Findings
4. High Findings
5. Medium Findings
6. Low Findings
7. Constitution Compliance Matrix
8. Phase-by-Phase Assessment
9. Test and CI Assessment
10. Production Readiness Blockers
11. Suggested Fix Plan
12. Final Rating

For each finding include:

- Severity
- File and line
- What is wrong
- Why it violates the constitution or production safety
- Concrete fix
- Test that should prove the fix

## Files To Attach Or Upload

Best option: upload the entire `api` folder. If you cannot upload the whole folder, attach the files and folders below.

Core governance and status:

- `ENGINEERING_CONSTITUTION.md`
- `PROJECT_STATUS.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `TECH_DEBT.md`
- `DATABASE_SCHEMA.md`
- `DECISIONS.md`
- `RUNBOOK.md`

Phase design and review prompts:

- `PHASE6_ANALYTICS_DESIGN.md`
- `PHASE6_REVIEW_PROMPT.md`
- `PHASE7_ANOMALY_ALERTS_DESIGN.md`
- `PHASE7_REVIEW_PROMPT.md`
- `PHASE8_DASHBOARD_DESIGN.md`
- `PHASE8_REVIEW_PROMPT.md`
- `PHASE9_SECURITY_AUTH_DESIGN.md`
- `PHASE9_REVIEW_PROMPT.md`
- `PHASE10_OBSERVABILITY_HARDENING_DESIGN.md`
- `PHASE10_REVIEW_PROMPT.md`

Project config and CI:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.build.json`
- `nest-cli.json`
- `eslint.config.mjs`
- `.env.example`
- `.github/workflows/ci.yml`

Application entry and database wiring:

- `src/main.ts`
- `src/app.module.ts`
- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/database/data-source.ts`
- `src/database/migrate.ts`

Ledger:

- `src/ledger/**`

Ingestion and WhatsApp:

- `src/ingestion/**`

Parsing and proposals:

- `src/parsing/**`

Reports and conversational queries:

- `src/reports/**`
- `src/conversational-query/**`

Analytics:

- `src/analytics/**`

Anomaly detection and alerts:

- `src/anomaly/**`

Dashboard:

- `src/dashboard/**`

Auth and security:

- `src/auth/**`

Observability:

- `src/observability/**`

Migrations:

- `src/migrations/1699999999000-CreateLedgerCore.ts`
- `src/migrations/1700000000000-ImmutabilityTriggers.ts`
- `src/migrations/1700000001000-TenantConsistencyAndPolicies.ts`
- `src/migrations/1700000002000-PostingLifecycle.ts`
- `src/migrations/1700000003000-LedgerHardening.ts`
- `src/migrations/1700000004000-InboundMessages.ts`
- `src/migrations/1700000005000-InboundRetryColumns.ts`
- `src/migrations/1700000006000-ReportReadIndexes.ts`
- `src/migrations/1700000007000-TransactionProposals.ts`
- `src/migrations/1700000008000-AnalyticsReadIndexes.ts`
- `src/migrations/1700000009000-AnomalyAlerts.ts`
- `src/migrations/1700000010000-SecurityAuth.ts`

Unit and integration tests:

- `src/**/*.spec.ts`
- `test/jest-e2e.json`
- `test/ledger.e2e-spec.ts`
- `test/reports.e2e-spec.ts`
- `test/conversational-query.e2e-spec.ts`
- `test/analytics.e2e-spec.ts`
- `test/anomaly.e2e-spec.ts`
- `test/dashboard.e2e-spec.ts`
- `test/observability.e2e-spec.ts`

## Known Local Verification State To Tell The Reviewer

Local verification after Phase 10:

- `npm run lint` passed.
- `npm run build` passed.
- `npm test -- --runInBand` passed: 25 suites, 139 tests.
- `git diff --check -- . ':!package-lock.json'` passed with Windows line-ending normalization warnings only.
- `npm run test:integration` was attempted, but local execution was blocked because Testcontainers could not find a working Docker/container runtime. The integration tests are present and must run in CI or a machine with Docker.
