# KasiCash Full-System Independent Review - Round 2

You are a senior backend, accounting-systems, security, and reliability engineer
performing an independent round-two review of KasiCash after remediation of the
first comprehensive review. Treat `ENGINEERING_CONSTITUTION.md` as binding.
Do not trust status documents or prior claims without tracing code, migrations,
tests, and CI evidence.

## Receipt Check

1. Confirm the archive opens and report the total file count.
2. Confirm receipt of all source, migrations, tests, CI, package lock, constitution,
   design/ADR/status/schema/runbook/tech-debt documents, and specifically:
   - `FULL_SYSTEM_REVIEW_ROUND1_FINDINGS.md`
   - `INDEPENDENT_REVIEW_REMEDIATION.md`
   - `src/database/database-options.ts`
   - migrations `1700000011000` through `1700000014000`
   - `test/migrations.e2e-spec.ts`
3. List any missing, unreadable, generated-only, or suspiciously duplicated files
   before reviewing behavior.

## Required Review Method

- Read the constitution first.
- Read the original full-system review findings and
  `INDEPENDENT_REVIEW_REMEDIATION.md`, but verify each claim independently.
- Trace every public route to auth/tenant context and every financial figure to
  posted ledger entries.
- Inspect both migration `up` and `down`; verify production boot, migration CLI,
  and integration tests use the same catalog.
- Run `npm ci`, `npm audit --audit-level=moderate`, `npm run build`,
  `npm run lint`, `npm test -- --runInBand`, `npm run test:integration`, and the
  migration run/revert/run/revert-all chain against PostgreSQL 15.
- Report exact command output summaries and distinguish code failures from
  environment failures.

## Re-test Every Round-One Blocker

1. **Historical classification**: post a transaction, attempt raw SQL and ORM
   changes to referenced account `business_id`, `code`, and `type`, and prove
   report meaning/figures cannot change.
2. **Reversals**: attempt orphan, cross-tenant, cross-currency,
   reversal-of-reversal, non-mirrored, and original-still-POSTED states. Force
   deferred constraints at commit. Verify the legal service reversal still works.
3. **Readiness/migrations**: test current, pending, failed-inspection, stopped DB,
   stale/disabled recovery worker, queue-query failure, and draining states. A
   dependency failure must never return ready.
4. **Lease fencing**: let worker A's lease expire, let B reclaim, then make A
   finalize/fail/heartbeat late. A must affect zero rows and send no reply.
5. **Ordering/proposals**: force a YES confirmation to execute before the earlier
   proposal for the same sender. Test simultaneous new proposal/YES/NO messages
   and prove at most one legal transition/post.
6. **Alert dispatch**: crash/fail before dispatch begins and after dispatch begins.
   The same anomaly must never be sent twice; post-dispatch ambiguity must remain
   terminal and contain no raw provider error.
7. **Rate limiting**: use two app/service instances sharing Postgres, spoof headers
   with trust proxy disabled/bounded, send high-cardinality keys, and verify shared
   limits, hashing, expiry, and bounded fallback behavior.
8. **Timezones**: run sessions in UTC and non-UTC zones, including DST boundaries,
   and prove report/analytics buckets and stored instants are identical.
9. **Money/currency**: verify bigint-only arithmetic and exact formatting for ZAR,
   USD, JPY, and BHD; unsupported currencies must fail in app and DB. Hunt for
   Number/parseFloat/float money math.
10. **Telemetry/privacy**: inject secrets, credentials, signatures, phone/email,
    message text, provider bodies, and money into errors on every path. None may
    appear in logs, metrics, readiness, DLQ output, or persisted raw-error columns.
11. **Webhook durability**: send valid-signature malformed payloads and prove exact
    raw bytes are stored before extraction in terminal quarantine state. Verify
    retries/redeliveries are idempotent.
12. **WhatsApp fail-closed behavior**: production startup without explicit cloud
    mode/token/phone ID must fail; provider failures must not leak response bodies.

## Security And Constitutional Regression Hunt

- Attempt cross-tenant reads/writes through every dashboard, report, auth,
  conversational, analytics, anomaly, ingestion, reversal, and ops route.
- Manipulate tenant IDs, account IDs, tokens, cookies, forwarded IP headers,
  pagination, date ranges, replay records, and idempotency keys.
- Verify AI/parser code proposes only; explicit human confirmation remains required
  and no auth/observability/remediation change created a ledger bypass.
- Verify immutable double-entry, balance, non-empty posting, entry-set immutability,
  idempotency, reversal, tenant, bigint-money, and provenance invariants remain DB-enforced.
- Verify the dashboard performs no client-side financial recomputation.
- Verify observability and detection remain side-effect-free on financial tables.

## Deliverable

Provide findings first, ordered Critical/High/Medium/Low, with exact file/line
references, exploit/failure scenario, affected invariant, and concrete fix. Then:

- receipt report;
- command/CI evidence table;
- round-one finding closure table: fixed / partially fixed / not fixed / regressed;
- phase-by-phase constitution compliance for Phases 1-10;
- remaining test gaps and production gates;
- ratings out of 10 for accounting correctness, DB integrity, tenant isolation,
  security, ingestion reliability, read-side correctness, observability, testing,
  documentation, and operability;
- final verdict: not ready / conditionally ready pending named evidence / production ready.

Do not award production-ready status without a green real-PostgreSQL CI run and
successful migration round-trip. Do not lower severity because a vulnerable path
is difficult to trigger through the normal UI when raw SQL, race, crash, retry,
or manipulated-request paths remain possible.
