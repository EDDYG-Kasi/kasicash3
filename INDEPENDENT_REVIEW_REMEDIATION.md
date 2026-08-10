# Independent Review Remediation

Date: 2026-08-02

This document maps the comprehensive full-system review findings to the
implemented remediation. It is evidence for a round-two reviewer, not a claim
of production readiness. The final verdict remains pending green CI against
real PostgreSQL.

## Critical

| Finding | Remediation | Primary evidence |
|---|---|---|
| C1 mutable account classification | A new DB trigger rejects `business_id`, `code`, or `type` changes after an account is referenced. | migration `1700000011000`; adversarial ledger e2e test |
| C2 incomplete reversal relationship/currency integrity | Deferred triggers enforce same-business, same-currency, posted mirrored reversal and a `REVERSED` original in both directions. Currency has a DB allowlist. | migration `1700000011000`; orphan/cross-currency/raw-SQL tests |

## High

| Finding | Remediation | Primary evidence |
|---|---|---|
| H1 readiness could lie | Runtime and tests share one migration catalog. Readiness catches DB/migration/queue failures and requires a successful fresh recovery cycle. | `database-options.ts`; `health.service.ts`; healthy/unhealthy tests |
| H2 expired lease lacked fencing | Every claim gets a random `claim_token`; heartbeat/finalize/failure are compare-and-set by token. Lease expiry is separate from retry time. | migration `1700000013000`; `ingestion.service.ts`; stale-owner tests |
| H3 sender/proposal races | Monotonic `ingest_sequence` blocks later same-sender claims while an earlier row is non-terminal. Proposal changes use a per-business advisory transaction lock and compare-and-set state transitions. | claim SQL; `parsing.service.ts`; forced-reordering test |
| H4 alert duplicate after crash | Dispatch records its point of no return before the provider call. Ambiguous outcomes become terminal `DELIVERY_UNCERTAIN` and cannot auto-retry. | migration `1700000014000`; anomaly dispatch unit tests |
| H5 bypassable/unbounded rate limit | Production instances share hashed expiring Postgres buckets. The fallback hashes keys, deletes expiry, and caps cardinality. Trust-proxy hops are bounded. | rate limiter service/migration/tests; `main.ts` |
| H6 timezone-ambiguous instant storage | Existing instants are converted explicitly from UTC to `timestamptz`; read SQL uses explicit UTC bounds and business-timezone buckets. | migration `1700000012000`; non-UTC-session analytics test |
| H7 assumed two-decimal currencies | Explicit registry defines ZAR/USD=2, JPY=0, BHD=3; unsupported currencies fail closed in service and DB. | `money/currency.ts`; report/ledger tests |
| H8 raw errors in telemetry/DLQ | Raw error columns are constrained to NULL. Bounded codes replace them. Telemetry uses allowlisted fields and omits private content/money. | migrations `1300`/`1400`; telemetry and health privacy tests |
| H9 malformed signed webhook not durable | Exact authenticated raw bytes and hashes are stored before message extraction; malformed messages become terminal quarantine records. | `webhook_deliveries`; service/unit/e2e tests |
| H10 missing WhatsApp credentials silently discarded sends | Production requires explicit cloud mode and both provider credentials; startup fails otherwise. Provider errors omit response bodies and use a timeout. | `createWhatsAppClient`; client tests; `.env.example` |

## Medium And Low

- Reversal lookup and race reconciliation require trusted `businessId`.
- Dashboard report periods are capped at 366 days and offsets at 10,000.
- Expired replay rows refresh expiry/signature/first-seen state.
- Shutdown starts draining in `beforeApplicationShutdown`, before provider teardown.
- Unknown-account login performs the same scrypt verification work as a wrong password.
- Production rejects insecure auth cookies.
- Parser input is bounded and amounts outside signed PostgreSQL bigint are rejected.
- Production and dev dependency audits report zero vulnerabilities; CI enforces the audit.
- `lint` is non-mutating, `lint:fix` is explicit, and CI checks `git diff --exit-code`.
- Repository text attributes enforce LF for source/config/docs, and CI runs `git diff --check`.
- Every integration suite uses the canonical production migration/entity catalog.
- A dedicated migration integration test runs, fully reverts, and reruns the catalog.

## Local Verification

- `npm run build`: passed.
- `npm run lint`: passed.
- `npm test -- --runInBand`: 26 suites, 157 tests passed.
- `npm audit`: 0 vulnerabilities.
- `npm run test:integration`: environment-blocked before test execution because
  this Windows machine has no Docker, Podman, WSL, or local PostgreSQL runtime.
  All eight suites were discovered and transformed. GitHub Actions remains the
  required real-PostgreSQL verdict.

## Residual Production Gates

- Green GitHub Actions, including Testcontainers and migration round-trip.
- Managed production secrets and tested rotation.
- TLS/reverse-proxy deployment review with correct bounded trust-proxy setting.
- Backup/restore drill, load test, SLOs/alerts, and independent penetration test.
- Provider delivery receipts before any operator retry of `DELIVERY_UNCERTAIN` alerts.
