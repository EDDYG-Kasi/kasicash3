# Independent Review Prompt - Phase 9 Round 1

You are a senior backend security/accounting-systems engineer performing an independent review of KasiCash Phase 9: Security & Auth.

First perform a receipt check of the delivered Phase 9 files, including auth services/controllers/guards/entities, migration `1700000010000-SecurityAuth`, dashboard/report auth changes, webhook/dev hardening changes, tests, ADR/design/status/schema/changelog/roadmap/tech-debt updates.

Verify:

- Authentication correctness: valid login succeeds, invalid/malformed/expired/revoked/disabled credentials fail safely, sessions are opaque and revocable.
- Authorization correctness: one principal maps to one business server-side; no route lets a caller select or override another tenant via query/body/path/token manipulation.
- Existing invariants remain intact: immutable append-only ledger, confirm-then-post transaction flow, AI never writes ledger or produces financial read figures, bigint minor-unit money, ingestion idempotency/recovery.
- Credential/secret handling: password hashes use salted `scrypt`; session tokens are stored only as hashes; passwords/tokens/secrets/signatures are not logged or committed.
- Webhook hardening: raw-body HMAC is still required; rate limiting, payload size checks, and replay suppression do not break ack-first/idempotent ingestion.
- Dashboard/report Phase 8 stub replacement: endpoints are authenticated and derive business/currency/timezone from the principal, never the client.
- Integration proof: the Testcontainers dashboard/report auth test seeds two real businesses, logs in real principals, attempts manipulated tenant/account IDs, and checks values against real PostgreSQL.

Hunt specifically for cross-tenant access, auth bypass, secret leakage, token replay mistakes, mutation-on-read, direct dashboard ledger writes, weakened ledger/confirm-flow/AI/money invariants, webhook changes that block legitimate retries, and any unauthenticated production data exposure.

Rate the work and give a verdict on completeness pending green CI.
