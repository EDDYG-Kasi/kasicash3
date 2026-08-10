# Independent Review Prompt - Phase 10, Round 1

You are a senior backend/reliability/security reviewer. Review KasiCash Phase 10:
Observability & Hardening.

Receipt-check the delivered files first, including the Phase 10 design, code,
tests, runbook, ADR/status docs, and any CI changes.

Verify:

- telemetry changes no financial behavior or invariant: ledger immutability,
  balance, confirm-then-post, AI boundaries, bigint money, tenant isolation, and
  ingestion idempotency remain untouched;
- structured logs, metrics, and traces/correlation contain no secrets, session
  tokens, webhook signatures, PII, raw message content, or money values;
- sanitization is tested with representative secret/PII/money inputs;
- `/health` and `/ready` reflect real process, DB, migration, recovery-worker,
  and shutdown state, including unhealthy cases;
- graceful shutdown respects the existing atomic claim/lease path so messages are
  neither dropped nor double-processed;
- the operator dead-letter endpoint is authenticated, tenant-scoped, metadata
  only, and does not expose payload/text/phone/money;
- the Testcontainers integration test hits health/readiness and DLQ metadata
  against a real migrated PostgreSQL database.

Hunt specifically for:

- instrumentation side effects on the ledger or read math;
- secrets, PII, private financial content, or money leaking into logs/metrics;
- health checks that can lie green when DB, migrations, recovery, or shutdown is
  unhealthy;
- cross-tenant access in operator endpoints;
- DLQ replay guidance that could bypass idempotency or create duplicate
  financial effects;
- any invariant regression introduced by the observability layer.

Rate the Phase 10 work and give a verdict on whether the full system
(Phases 1-10) is production-ready pending a green CI run. List anything still
blocking production readiness.
