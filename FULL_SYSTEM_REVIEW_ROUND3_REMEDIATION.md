# Full-System Review Round 3 Remediation

Date: 2026-08-03

This document maps the independent Round 3 findings to the implemented changes
and evidence. It does not claim production readiness. Real PostgreSQL 15 CI and
an immutable revision/CI URL remain required.

## Finding Map

### R3-H01 - PostgreSQL and CI proof

Status: **externally blocked, not closed**.

- The repository now discovers 10 Testcontainers suites and 65 integration
  tests, including the new legacy-upgrade fixture.
- This workstation has no Docker, Podman, PostgreSQL service, or `psql`, so the
  tests cannot execute here.
- CI remains configured to run all integration tests against PostgreSQL 15 and
  perform migration run/revert/run/revert-all.
- Production readiness remains pending a clean immutable commit SHA and green
  CI URL.

### R3-H02 - unsafe legacy upgrade

Status: **implemented; PostgreSQL execution pending**.

- Migration `1700000014500` creates bounded category/count diagnostics and an
  auditable rollback record for semantics-preserving canonicalization only.
- It canonicalizes recognized source/kind/currency casing and exact SHA-256
  casing. It never fabricates provenance, currencies, or financial facts.
- Migration `1700000014900` blocks before `1700000015000` when ambiguous rows
  remain. Migration execution uses transaction-per-migration so preflight
  diagnostics survive a gate failure.
- `test/legacy-upgrade.e2e-spec.ts` builds a database through `1400`, seeds
  legacy canonicalizable and ambiguous rows, proves the gate, performs explicit
  operator remediation, and completes the catalog.

### R3-H03 - proposal facts not bound to confirmation

Status: **implemented; PostgreSQL execution pending**.

- Migration `1700000016000` adds a database-generated proposal digest, strict
  `SALE`/`EXPENSE` kind allowlist, immutable source/economic facts, and a
  deferred proposal-to-ledger match trigger.
- The user prompt includes a short reference derived from the immutable digest.
- Confirmation takes a pessimistic row lock, validates kind/digest, and calls
  `LedgerService.postTransactionWithManager()` inside the same active database
  transaction as `PENDING -> CONFIRMED`.
- The deferred trigger verifies tenant, amount, currency, description,
  provenance, times, idempotency key, two-entry shape, and expected account
  mapping.
- Unit tests fail closed on unknown kind/missing digest. PostgreSQL tests attempt
  ORM/raw-SQL mutations of every protected fact, reject a forged transaction
  link, and inject a confirmation-state failure to prove ledger rollback.

### R3-M01 - webhook transport/policy mismatch

Status: **implemented; PostgreSQL HTTP execution pending**.

- `resolveWebhookBodyLimits()` is the single source for the policy and absolute
  transport ceilings.
- HMAC verification precedes policy rejection. Authenticated bodies over policy
  but within the absolute anti-DoS ceiling are stored exactly and terminalized
  as `QUARANTINED/PAYLOAD_TOO_LARGE`.
- The real HTTP integration test accepts a valid signed body above 1 MiB under a
  2 MiB policy and durably quarantines an authenticated body above policy.

### R3-M02 - application/database clock skew

Status: **implemented; PostgreSQL execution pending**.

- Rate-limit and replay expiry are calculated exclusively from PostgreSQL
  `now()` plus a duration parameter.
- Unit tests assert no application timestamp is sent. The dashboard integration
  suite skews `Date.now()` to 2099 while proving the shared database limit still
  expires relative to PostgreSQL.

### R3-M03 - ambiguous alert downgrade

Status: **implemented; PostgreSQL execution pending**.

- Migration `1700000017000` refuses to begin rollback while any
  `DELIVERY_UNCERTAIN` row exists.
- The migration round-trip integration test seeds this state and proves the
  down migration refuses until the operator explicitly reconciles/removes it.

### R3-L01 - dashboard numeric coercion

Status: **closed locally**.

- Limit/offset accept decimal digit strings only, require safe integers, and
  reject out-of-range values instead of defaulting or clamping malformed input.
- Unit coverage includes blank, fraction, scientific notation, negative, zero,
  overflow, and out-of-range inputs.

### R3-L02 - hostile resolver objects

Status: **closed locally**.

- Resolver output must be a non-proxy plain/null-prototype object containing
  only own enumerable data properties and no symbols/accessors.
- Strings/dates/numbers are bounded and validated, then copied into fresh
  canonical objects.
- Tests cover prototypes, accessors without invocation, proxies, symbols,
  hidden fields, NaN, infinity, fractions, and unsafe integers.

### R3-L03 - balance aggregate overflow

Status: **implemented; PostgreSQL execution pending**.

- Migration `1700000017000` replaces trigger accumulator variables and CASE
  values with PostgreSQL `numeric` while each stored entry remains `bigint`.
- The ledger integration suite posts two maximum-bigint debits and credits, so
  each side exceeds signed bigint while remaining balanced.

## Local Verification

- TypeScript production build: pass.
- ESLint: pass.
- Jest unit tests: 28 suites, 194 tests, pass.
- Testcontainers discovery: 10 suites, 65 tests.
- Real PostgreSQL execution: blocked by missing local runtime; CI required.

