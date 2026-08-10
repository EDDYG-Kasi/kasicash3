# KasiCash Full-System Independent Review - Round 4

You are the independent senior backend, accounting-systems, database, security,
and reliability reviewer for KasiCash. Review the supplied archive from first
principles. Do not trust status documents or prior remediation claims without
matching code, migration, test, and execution evidence.

## Receipt Check

1. Identify the archive filename and compute SHA-256.
2. Test the ZIP, count files/directories, and reject unsafe paths, duplicate
   paths, secrets, `.env`, build output, dependency folders, or Git metadata.
3. Confirm the full source, 21 ordered migrations through
   `1700000017000`, 28 unit suites, 10 integration suites, constitution,
   schema/ADR/runbook/status documents, Round 3 findings, and Round 3
   remediation are present.
4. State whether an immutable Git commit SHA and CI URL were supplied. Archive
   bytes alone are not CI provenance.

## Mandatory Execution

Use Node/npm versions compatible with the repository and a real PostgreSQL 15
runtime. Execute and report exact commands/results:

```bash
npm ci
npm run build
npm run lint
npm test -- --runInBand
npm run verify:text
npm audit --audit-level=high
npm run test:integration
npm run migration:run
npm run migration:revert
npm run migration:run
npm run migration:revert:all
```

Re-run migrations and integration tests on a fresh clean schema. Do not count
an integration test that aborts in setup as passed. If PostgreSQL cannot run,
mark all database/concurrency findings unverified and production readiness
unavailable.

## Round 3 Regression Audit

### Legacy upgrade safety

- Build a database only through migration `1700000014000`.
- Seed rows legal under that schema: recognized noncanonical source/hash/kind
  forms and ambiguous unsupported provenance/currencies across every affected
  table.
- Verify `1450` records only bounded categories/counts and performs only
  reversible semantics-preserving canonicalization.
- Verify `1490` blocks before `1500` while ambiguity remains, diagnostics survive
  the failed migration, no PII/private text/money is exposed, explicit operator
  remediation permits upgrade, and the full down path restores canonicalized
  legacy values.
- Hunt for trigger-disable windows, stale diagnostics, partial migration state,
  irreversible normalization, or ways to bypass the gate.

### Proposal confirmation integrity

- Verify proposal source/economic fields and digest are database-immutable after
  insert, including raw SQL and ORM attempts against every field.
- Verify kind is strictly `SALE` or `EXPENSE`; unknown values fail closed.
- Verify the displayed prompt reference derives from the stored immutable digest.
- Prove the exact pending proposal is row-locked and ledger posting plus
  `CONFIRMED` transition use one database transaction.
- Inject failure before proposal confirmation commits and prove no ledger row or
  entries survive.
- Forge a proposal link to a transaction with wrong tenant, amount, currency,
  description, provenance, timestamp, idempotency key, entry count, or account
  mapping; every commit must fail.

### Webhook durability

- Through real HTTP, send a valid signed JSON body above 1 MiB but below a 2 MiB
  policy and prove exact bytes are accepted/stored.
- Send a valid signed body above policy but below the absolute transport ceiling
  and prove exact bytes reach terminal `QUARANTINED/PAYLOAD_TOO_LARGE`.
- Verify invalid signatures are not persisted and the HMAC covers exact raw
  bytes. Confirm the absolute transport ceiling is documented as pre-auth
  anti-DoS loss.

### Distributed clocks, downgrade, and aggregates

- Skew two application clocks ahead/behind PostgreSQL and prove shared login and
  webhook rate windows cannot be bypassed or extended incorrectly.
- Seed `DELIVERY_UNCERTAIN`; verify the first down migration refuses and no
  compatible prior app can redispatch it as `FAILED` without explicit operator
  reconciliation.
- Post a balanced transaction whose debit and credit totals each exceed signed
  bigint while individual entries remain valid bigint; commit must succeed.

### Strict external inputs

- Repeat dashboard limit/offset probes: blank, zero, negative, fraction,
  scientific notation, infinity, unsafe integer, and above maximum. All malformed
  or out-of-range values must reject.
- Probe resolver outputs with custom prototypes, inherited values, getters,
  setters, symbols, non-enumerable fields, proxies, throwing traps/accessors,
  overlong strings, malformed dates, NaN/infinity/fractions/unsafe integers.
  Validation must not invoke accessors and must return fresh canonical data.

## Full-System Constitutional Audit

Re-audit Phases 1-10, not only changed files:

- immutable balanced double-entry ledger and atomic reversals;
- bigint minor-unit money, explicit currency metadata, no float money;
- durable idempotent WhatsApp ingestion, ordering, leases, recovery and DLQ;
- human confirm-before-post and AI never writing or producing read-side figures;
- reports/analytics/anomalies from posted/reversed ledger rows with correct
  reversal netting and timezone-explicit tenant-scoped reads;
- authenticated server-side tenant isolation on every API/dashboard route;
- no secret, PII, private financial text, or money leakage in telemetry;
- truthful readiness, graceful shutdown, and no instrumentation side effects.

Actively hunt for mutation-on-read, cross-tenant access, client-selected tenant
scope, transaction nesting, trigger race windows, migration drift, retry of
ambiguous external effects, raw exception leakage, and health checks that lie.

## Required Output

1. Receipt/environment and exact executed evidence.
2. Verdict: `Ready`, `Ready with conditions`, or `Not ready`.
3. Findings ordered Critical/High/Medium/Low, each with failure scenario, exact
   file/line evidence, violated invariant, remediation, and missing regression.
4. A Round 3 finding table: fixed / partial / not fixed / unverified.
5. Phase 1-10 scorecard and accounting-invariant scorecard.
6. Migration/upgrade/downgrade verdict.
7. Security/privacy/tenant-isolation verdict.
8. Explicit blockers to production.
9. Overall rating out of 10.

Do not issue a production-ready verdict without green real-PostgreSQL tests,
full migration round trip, clean-schema rerun, and traceable immutable CI proof.

