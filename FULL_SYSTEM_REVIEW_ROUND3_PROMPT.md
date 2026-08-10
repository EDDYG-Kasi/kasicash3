# KasiCash Full-System Independent Review - # 1. Receipt check and environment

The archive extracts cleanly. The repository root is [round3-review](sandbox:/workspace/scratch/b1261b758788/round3-review).

| Item                  | Result                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| Archive               | `kasicash-full-round2-remediated-2026-08-03.zip`                        |
| SHA-256               | `7b23347aa8e74185a2877622dbb655971b3e9489b3490ebfaa6f49ecec0217d6`      |
| ZIP test              | Pass                                                                    |
| Inventory             | 194 entries: 169 files and 25 directories                               |
| Repository layout     | 40 root files, 117 `src/` files, 10 `test/` files, 1 workflow, 1 script |
| Runtime               | Linux x86-64; Node `v24.14.0`; npm `11.9.0`                             |
| PostgreSQL 15         | Unavailable                                                             |
| Docker/Testcontainers | No Docker, Podman, nerdctl, or compatible runtime                       |
| Git revision          | Unavailable: archive contains no `.git` metadata                        |
| CI URL/result         | Unavailable                                                             |

Confirmed present:

* `package.json`, `package-lock.json`
* `ENGINEERING_CONSTITUTION.md`
* `src/`, including ledger, ingestion, parsing, reports, conversational queries, analytics, anomaly, dashboard, authentication, observability, money, configuration, and database modules
* 17 migrations through `1700000015000-RoundTwoIntegrityHardening.ts`
* 28 unit suites and 9 PostgreSQL integration suites
* `.github/workflows/ci.yml`
* Round 1 and Round 2 findings/remediation documents
* Database schema, ADRs, runbook, roadmap, changelog, project status, technical debt, phase design documents, and review prompts

Pre-review hygiene findings:

* No missing expected files.
* No unreadable, empty, duplicate-path, or duplicate-content files.
* No unsafe ZIP paths or extraction traversal.
* No `node_modules`, `dist`, coverage output, private keys, local `.env`, or Git metadata in the archive.
* Secret scanning found only explicit test fixtures and example values.
* No CRLF files, trailing whitespace, or merge markers.
* The absence of Git metadata is material: the archive hash identifies the bytes, but cannot prove an immutable commit, clean worktree, migration append-only history, or correspondence to a CI run.

# 2. Verdict

**Not ready.**

The static accounting design is materially stronger than Round 2, but production readiness is constitutionally unavailable without a green PostgreSQL 15 run, successful migration round-trip, and identifiable clean revision. There are also substantive unresolved defects in proposal integrity, migration upgrade safety, webhook durability boundaries, and distributed rate-limit expiry.

# 3. Findings

No Critical finding was established from the executable evidence available.

## High

### R3-H01 — No real-PostgreSQL or identifiable-CI proof exists

Failure scenario: trigger SQL, migration ordering, timezone behavior, or concurrency fencing fails on PostgreSQL despite 172 mocked/unit tests passing. All 60 integration tests aborted before their bodies executed.

Evidence:

* The constitution explicitly requires real-database tests and green CI: [ENGINEERING_CONSTITUTION.md:97,98,99,100](sandbox:/workspace/scratch/b1261b758788/round3-review/ENGINEERING_CONSTITUTION.md).
* The repository itself records every phase as pending green CI: [ROADMAP.md:5,6,7,8,9,10,11,12,13](sandbox:/workspace/scratch/b1261b758788/round3-review/ROADMAP.md).
* CI is configured for PostgreSQL 15 and the required commands, but no run result or revision accompanies the archive: [.github/workflows/ci.yml:12,14,35,48,49,71,72,73](sandbox:/workspace/scratch/b1261b758788/round3-review/.github/workflows/ci.yml).

Violated invariant: Constitution §8.2–§8.4—database guarantees must be proven against a real database, with green CI and traceable evidence.

Remediation: run the complete job from a signed or otherwise immutable commit, publish the commit SHA and CI URL, and retain outputs for the full migration cycle and clean-schema rerun.

Missing regression evidence: all 60 PostgreSQL tests; production startup against migrated PostgreSQL; migration run/revert/run/revert-all; rerun and integration suite on a clean schema.

---

### R3-H02 — Migration `1700000015000` is unsafe for legitimate legacy rows

Failure scenario: a database successfully running through migration `1700000014000` contains data valid under that schema—such as a short/uppercase API payload hash, an older source type, or a three-letter principal/proposal/alert currency outside the new four-code catalog. Migration `1700000015000` adds validating constraints immediately and aborts the production upgrade.

Evidence:

* New constraints are added without preflight, cleanup, quarantine, `NOT VALID`, or staged validation: [1700000015000-RoundTwoIntegrityHardening.ts:50,54,56,60,65,69,72,78](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000015000-RoundTwoIntegrityHardening.ts).
* The preceding ledger schema required only nonblank hashes/source types: [1700000003000-LedgerHardening.ts:143,145,146,149,150,154,155](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000003000-LedgerHardening.ts).
* Proposals and principals previously accepted any uppercase three-letter currency and arbitrary nonempty proposal hash: [1700000007000-TransactionProposals.ts:16,17,20,36,37](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000007000-TransactionProposals.ts), [1700000010000-SecurityAuth.ts:15,25](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000010000-SecurityAuth.ts).
* The migration CLI intentionally hides all diagnostic detail behind one code: [migrate.ts:27,28,29](sandbox:/workspace/scratch/b1261b758788/round3-review/src/database/migrate.ts).

Violated invariant: Constitution §6.3 and §7—failures must be recoverable, and ordered migrations must safely move real databases forward.

Remediation: add a preceding preflight/remediation migration that reports bounded category counts, resolves or quarantines invalid legacy records according to an explicit policy, adds constraints as `NOT VALID` where supported, then validates them. Do not expose raw PII or financial content in diagnostics.

Missing regression test: migrate through `14000`, insert every legacy-valid/noncanonical form in all four currency-bearing tables and transactions/proposals, then apply `15000` and verify the documented remediation behavior.

---

### R3-H03 — A confirmed proposal is not bound to the economic facts the user saw

Failure scenario: after the user receives “sale R30; reply YES,” an ORM bug or raw SQL changes the pending proposal to an expense, changes `amount_minor`, currency, description, timestamp, or provenance. A subsequent legitimate `YES` reads those mutable fields and posts the altered transaction.

Evidence:

* The proposal table has no economic-field immutability trigger, no `kind` allowlist, and no version/digest binding to the prompt: [1700000007000-TransactionProposals.ts:13,18,19,20,21,22,23,32,38](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000007000-TransactionProposals.ts).
* Round 2 hardening adds only currency/hash constraints, not proposal immutability: [1700000015000-RoundTwoIntegrityHardening.ts:65,67,69](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000015000-RoundTwoIntegrityHardening.ts).
* Confirmation loads the current mutable row and posts it before the proposal CAS update: [parsing.service.ts:130,136,138,142,145,148,153,162](sandbox:/workspace/scratch/b1261b758788/round3-review/src/parsing/parsing.service.ts).
* Unknown `kind` values are cast and fall into the expense branch: [parsing.service.ts:148,251,257,270](sandbox:/workspace/scratch/b1261b758788/round3-review/src/parsing/parsing.service.ts).

Violated invariant: Constitution §4.1. A human confirmation must authorize the actual proposal posted, not merely any row currently marked `PENDING`.

Remediation:

* Make proposal source/economic fields immutable after insert.
* Add DB allowlists for `kind` and complete provenance/message shapes.
* Bind the prompt to a proposal version or digest.
* Transition/claim the exact proposal before posting and make proposal confirmation plus ledger posting one recoverable atomic protocol.
* Enforce that the linked transaction matches proposal tenant, amount, currency, provenance, kind/account mapping, and source message.

Missing regression test: after a prompt is issued, attempt ORM and raw-SQL mutation of every proposal economic/source field; all must fail, and confirmation must post exactly the displayed immutable proposal.

## Medium

### R3-M01 — The HTTP parser can discard valid signed bytes before durable ingestion

Executed probe: with `KASICASH_WEBHOOK_MAX_RAW_BYTES` represented as 2 MiB, a signed request of approximately 1.1 MiB received HTTP 413 and `ingestSignedWebhook` was called zero times.

Evidence:

* Express has a hard-coded 1 MiB limit: [main.ts:10,11,12,14](sandbox:/workspace/scratch/b1261b758788/round3-review/src/main.ts).
* Application configuration advertises support up to 10 MiB: [webhook-security.service.ts:56,58,60,63](sandbox:/workspace/scratch/b1261b758788/round3-review/src/auth/webhook-security.service.ts).
* The controller’s policy limit is evaluated before HMAC verification or storage: [whatsapp.controller.ts:61,64,77](sandbox:/workspace/scratch/b1261b758788/round3-review/src/ingestion/whatsapp.controller.ts).

Violated invariant: Constitution §5.2 and §6.1—authenticated bytes must be verified over the exact body and durably classified before processing or loss.

Remediation: derive both transport and controller limits from one validated configuration. Set a small absolute transport ceiling, verify HMAC, and durably quarantine authenticated policy-rejected bodies within that ceiling.

Missing regression test: real HTTP tests for a valid signed body between 1 MiB and the configured maximum, plus an authenticated body over the policy maximum with a terminal durable disposition.

---

### R3-M02 — Rate-limit expiry is vulnerable to application/DB clock skew

Failure scenario: one application instance runs 20 minutes behind the database. It writes `expires_at` in the database’s past. Every request sees an expired row and resets the count to one, bypassing login or webhook rate limits. A fast clock can cause excessive lockout.

Evidence:

* Expiry is calculated using application `Date.now()`: [rate-limiter.service.ts:69,70](sandbox:/workspace/scratch/b1261b758788/round3-review/src/auth/rate-limiter.service.ts).
* The atomic reset decision uses PostgreSQL `now()`: [rate-limiter.service.ts:77,78,85,86](sandbox:/workspace/scratch/b1261b758788/round3-review/src/auth/rate-limiter.service.ts).

Violated invariant: security must fail safely and distributed limits must be shared, atomic, and expiry-correct.

Remediation: pass the window duration and calculate `expires_at` entirely from PostgreSQL `now()`. Keep window creation, reset, increment, and expiry on one database clock.

Missing regression test: two limiter instances with intentionally skewed application clocks sharing one PostgreSQL table.

---

### R3-M03 — Migration rollback converts terminal ambiguous sends into retryable failures

Failure scenario: a provider accepts an alert, but its database state is `DELIVERY_UNCERTAIN`. Rolling back migration `14000` changes that row to `FAILED`; dispatch logic treats `FAILED` as retryable and may contact the provider a second time.

Evidence:

* The down migration changes terminal uncertainty to `FAILED`: [1700000014000-SecurityAndNotificationHardening.ts:64,65,66,67](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000014000-SecurityAndNotificationHardening.ts).
* Alert claiming explicitly reclaims `FAILED`: [anomaly.service.ts:436,437,443](sandbox:/workspace/scratch/b1261b758788/round3-review/src/anomaly/anomaly.service.ts).

Violated invariant: Constitution §6.2 and §6.4—ambiguous non-ledger side effects must never be retried in a way that creates duplicates.

Remediation: make rollback refuse while uncertain rows exist, preserve terminal state in a compatible archival table, or provide a safe nonretryable mapping with explicit operator acknowledgement.

Missing regression test: populate an ambiguous accepted alert, run the down migration, boot the compatible previous application, and prove repeated dispatch never invokes the provider.

## Low

### R3-L01 — Dashboard pagination still accepts or silently rewrites malformed limits

Executed results:

| Input               |                   Result |
| ------------------- | -----------------------: |
| `1e2`               |        accepted as `100` |
| `1e9`               |        accepted as `100` |
| `1.5`               | silently changed to `20` |
| `Infinity`          | silently changed to `20` |
| `0`                 | silently changed to `20` |
| huge unsafe integer |        accepted as `100` |

Evidence: [dashboard.service.ts:306,308,309,310](sandbox:/workspace/scratch/b1261b758788/round3-review/src/dashboard/dashboard.service.ts).

The query remains bounded, so this is not a resource-exhaustion defect, but Round 2’s claim of strict rejection is false.

Violated invariant: external input is untrusted and should fail predictably.

Remediation: accept only `/^\d+$/`, require a safe integer, and reject outside `1..100` rather than defaulting or clamping malformed input.

Missing regression test: direct dashboard controller/service matrix for scientific notation, fractions, infinity, zero, unsafe integers, and huge limits.

---

### R3-L02 — Resolver validation accepts inherited fields and executes getters

Executed probe:

* A prototype-derived `{ kind: CASH_BALANCE, currency: USD }` was accepted.
* An accessor-backed currency was accepted and the getter executed twice.

Evidence:

* `isRecord` accepts any nonarray object: [conversational-query.resolver.ts:225,226](sandbox:/workspace/scratch/b1261b758788/round3-review/src/conversational-query/conversational-query.resolver.ts).
* Validation reads properties directly and checks only enumerable own keys: [conversational-query.resolver.ts:130,132,136,154,156,216,220](sandbox:/workspace/scratch/b1261b758788/round3-review/src/conversational-query/conversational-query.resolver.ts).

The current resolver is application-owned and heuristic, limiting current exploitability, but the boundary is not strict enough for the planned external AI provider.

Violated invariant: Constitution §4.3—AI output is untrusted and must be strictly validated before reads.

Remediation: require `Object.getPrototypeOf(value) === Object.prototype` or `null`, reject accessor descriptors and symbol keys, copy validated primitive fields into new plain objects, and bound all strings.

Missing regression test: prototypes, getters, setters, symbol keys, proxies, nonfinite numbers, hidden fields, and throwing accessors.

---

### R3-L03 — Balanced aggregate totals can overflow the trigger’s `bigint` variables

Failure scenario: every individual entry fits signed PostgreSQL `bigint`, but several entries make total debits and credits exceed `9,223,372,036,854,775,807`. Application validation accepts the entries; the deferred trigger tries to assign PostgreSQL’s `SUM(bigint)` result to a `bigint` variable and aborts.

Evidence:

* Trigger totals are declared `bigint`: [1700000000000-ImmutabilityTriggers.ts:63,64,65](sandbox:/workspace/scratch/b1261b758788/round3-review/src/migrations/1700000000000-ImmutabilityTriggers.ts).
* Application validation limits individual entries, while totals use unbounded JavaScript `bigint`: [ledger.service.ts:40,41,78,89,90,91,94](sandbox:/workspace/scratch/b1261b758788/round3-review/src/ledger/ledger.service.ts).

Violated invariant: deterministic bigint-only money behavior and consistent application/database acceptance.

Remediation: declare trigger totals as exact PostgreSQL `numeric`, or document and validate a maximum aggregate transaction amount in both layers.

Missing regression test: a balanced multi-entry transaction whose individual entries fit `bigint` but whose side totals exceed signed 64-bit range.

# 4. Round 2 closure audit

“Fixed” below means the specific closure was independently supported locally. PostgreSQL-dependent items remain partial where their actual enforcement could not execute.

| ID                             | Status              | Independent evidence                                                                                                                                                                                     |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 production DB containment | **Fixed**           | No `pg-mem` dependency/path; one PostgreSQL builder with `synchronize:false`. Production probes rejected `memory` and arbitrary modes; missing/`postgres` modes attempted PostgreSQL and did not listen. |
| C-02 classification race       | **Partially fixed** | Unconditional trigger closes the code-level race, but the two-connection PostgreSQL test could not run and does not cover raw plus ORM changes to all three fields and report stability.                 |
| H-01 raw webhook durability    | **Partially fixed** | Exact bytes are stored before JSON parsing for accepted transport sizes. The hard-coded 1 MiB parser bypasses configured limits and durability. HTTP matrix omits several required shapes.               |
| H-02 sender ordering           | **Partially fixed** | Advisory insertion lock and sequence exclusion are sound statically. PostgreSQL barriers did not execute; no simultaneous proposal/YES/NO three-way test exists.                                         |
| H-03 AI containment            | **Partially fixed** | Own invented fields fail closed and application-owned clarification text is used. Prototype/accessor objects remain accepted.                                                                            |
| H-04 production dev route      | **Fixed**           | Production controller graph omits `DevController`; production flags fail before Nest construction.                                                                                                       |
| M-01 alert ambiguity           | **Partially fixed** | Unit tests prove intended SQL and no immediate retry. No real-database accept/fail/recover/reconcile execution occurred; the down migration reintroduces retryability.                                   |
| M-02 report bounds             | **Partially fixed** | `ReportsController` and `ReportsService` are strict and bounded. `DashboardService` still accepts/coerces malformed limits.                                                                              |
| M-03 timezone determinism      | **Partially fixed** | UTC rendering SQL and local DST calculations look correct. Required PostgreSQL session/timezone/DST matrix did not execute.                                                                              |
| M-04 provenance                | **Partially fixed** | App and final-schema constraints are strong. PostgreSQL boundary tests did not run, and the upgrade migration does not handle preceding-schema data.                                                     |
| M-05 currency contract         | **Partially fixed** | ZAR/USD/JPY/BHD formatting uses bigint and correct scales; final-schema FKs exist. Actual DB rejection across every table did not run.                                                                   |
| M-06 privacy                   | **Partially fixed** | Unit logs and migration CLI use bounded codes, and provider bodies are discarded. No exhaustive captured Nest/CLI/DLQ/metrics/trace injection run was possible.                                          |
| L-01 early cookie validation   | **Fixed**           | Insecure production cookies and incomplete WhatsApp configuration are rejected before Nest/DB creation.                                                                                                  |
| L-02 CI `psql` masking         | **Fixed**           | The `psql` command must succeed and the value must be numeric zero.                                                                                                                                      |
| L-03 text hygiene              | **Fixed**           | `npm run verify:text` passed; archive contains LF text with no trailing whitespace.                                                                                                                      |
| L-04 smoke documentation       | **Fixed**           | README and CI provide and assert the developer token and use PostgreSQL.                                                                                                                                 |

# 5. Phase-by-phase assessment

| Phase                      | Assessment                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Ledger                 | Strong static constraint design: immutable entries/transactions, composite tenant FKs, balance/nonempty checks, lifecycle sealing, and full reversal matrix. Actual PG15 enforcement is unproven; aggregate overflow remains. |
| 2 — Ingestion              | Durable delivery/inbound tables, idempotency, claims, leases, fencing, retry and DLQ code are present. Raw transport-size mismatch and blocked concurrency tests prevent acceptance.                                          |
| 3 — Confirm-then-post      | Parsing itself only proposes and YES/NO transitions are serialized. Proposal economic facts are mutable and not bound to what the human saw; phase is not constitutionally complete.                                          |
| 4 — Reports                | Ledger-only, tenant/currency scoped, `POSTED`/`REVERSED` aware, bigint formatting, bounded periods, and explicit read-only transactions. PG behavior remains gated.                                                           |
| 5 — Conversational queries | Figures come from report services, not resolver output. Account/date/limit allowlists are present. Resolver object hardening and real tenant/timezone/currency breadth remain incomplete.                                     |
| 6 — Analytics              | Queries use posted ledger rows, tenant/currency filters, explicit timezones and read-only transactions. Dashboard chart scales are server-generated; the browser does not recompute money. PG timezone proof is blocked.      |
| 7 — Anomalies              | Detection is ledger-derived and bigint-only; dispatch has point-of-no-return state and reconciliation. Real ambiguity tests are missing, and down migration semantics can re-enable duplicates.                               |
| 8 — Dashboard              | Authenticated tenant context is server-derived. Financial DTOs originate from reports/analytics; frontend displays `formatted` values. Pagination validation remains inconsistent.                                            |
| 9 — Auth/security          | Salted scrypt passwords, hashed session tokens, secure cookies, tenant-bound principals and hashed DB rate counters are present. Clock-skew expiry, MFA/RBAC, KMS, and penetration-test evidence remain.                      |
| 10 — Observability         | Readiness checks DB, migrations, queue query, recovery freshness, and draining state. Logs use bounded codes and DLQ output is tenant-scoped. Metrics/log durability, SLOs and production-like load evidence remain open.     |

# 6. Public-route and tenant trace

| Routes                              | Authentication / tenant source                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                             | Public; static service identity only.                                                                                         |
| `POST /auth/login`                  | Public; separate IP/account rate keys; principal and business loaded from DB.                                                 |
| `GET /auth/me`, `POST /auth/logout` | `AuthGuard`; tenant is bound to the hashed session token’s principal.                                                         |
| `GET /webhooks/whatsapp`            | Public verification handshake; token checked server-side.                                                                     |
| `POST /webhooks/whatsapp`           | Public transport, exact-body HMAC required; tenant later resolves from signed `wa_from` through unique `businesses.wa_phone`. |
| `/dev/whatsapp/text`                | Present only outside production; additionally requires enabled flag, constant-time token and rate limit.                      |
| `/reports/*`                        | `AuthGuard`; business, currency and timezone come from the attached principal. Client tenant fields are ignored.              |
| `/dashboard/*`                      | Class-level `AuthGuard` plus `DashboardTenantGuard`; all endpoints and assets use principal-derived context.                  |
| `GET /health`, `/ready`, `/metrics` | Public operational data; no tenant or financial payloads.                                                                     |
| `GET /ops/dead-letter`              | `AuthGuard`; query filters `message.businessId = principal.businessId` and omits payload/body/phone.                          |

There are no public ledger-posting, reversal, anomaly-dispatch, replay-remediation, or operator mutation routes.

# 7. Financial-figure trace

| Surface                | Deterministic source                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash position          | `entries` joined to tenant accounts and `POSTED`/`REVERSED` transactions; [reports.service.ts:93,109,116,118,131,143](sandbox:/workspace/scratch/b1261b758788/round3-review/src/reports/reports.service.ts)                                                             |
| Income statement       | Ledger entries grouped by frozen `400`/`500` account families and bounded UTC period; [reports.service.ts:161,182,189,190,191,192,193](sandbox:/workspace/scratch/b1261b758788/round3-review/src/reports/reports.service.ts)                                            |
| Account statement      | Tenant/account validation, ledger opening balance, ordered running total and bounded pagination; [reports.service.ts:235,241,268,295,340](sandbox:/workspace/scratch/b1261b758788/round3-review/src/reports/reports.service.ts)                                         |
| Analytics              | Same ledger joins, tenant/currency/status filters, explicit local-to-UTC buckets; [analytics.service.ts:269,281,282,283,302,303](sandbox:/workspace/scratch/b1261b758788/round3-review/src/analytics/analytics.service.ts)                                              |
| Anomalies              | Analytics series plus active posted expense candidates; bigint thresholds only; [anomaly.service.ts:74,79,87,93,391,410,412,413](sandbox:/workspace/scratch/b1261b758788/round3-review/src/anomaly/anomaly.service.ts)                                                  |
| Conversational replies | Resolver selects intent/parameters; figures are inserted only from `ReportsService` DTOs; [conversational-query.service.ts:153,158,166,178,193,251,272](sandbox:/workspace/scratch/b1261b758788/round3-review/src/conversational-query/conversational-query.service.ts) |
| Dashboard              | Uses report/analytics/anomaly services. Browser renders `value.formatted`; [dashboard.frontend.ts:375,376](sandbox:/workspace/scratch/b1261b758788/round3-review/src/dashboard/dashboard.frontend.ts)                                                                   |

No `parseFloat` exists. The only `toFixed` is for a nonfinancial, server-derived bar-width percentage. Money arithmetic uses JS `bigint`, PostgreSQL integer/numeric aggregation, and string DTOs.

# 8. Command, migration, audit, hygiene, and CI evidence

| Command/probe                        | Result                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `unzip -t`                           | Pass                                                                                              |
| `npm ci`                             | Pass; 853 packages installed                                                                      |
| `npm run verify:text`                | Pass                                                                                              |
| `npm run build`                      | Pass                                                                                              |
| `npm run lint`                       | Pass                                                                                              |
| `npm test -- --runInBand`            | Pass: 28 suites, 172 tests                                                                        |
| `npm audit --audit-level=moderate`   | Pass: 0 vulnerabilities                                                                           |
| `npm run test:integration`           | **Environment failure**: 9 suites/60 tests aborted at Testcontainers startup; no test body proved |
| `npm run migration:run`              | **Environment failure**, exit 1: no PostgreSQL                                                    |
| `npm run migration:revert`           | **Environment failure**, exit 1                                                                   |
| second `npm run migration:run`       | **Environment failure**, exit 1                                                                   |
| `npm run migration:revert:all`       | **Environment failure**, exit 1                                                                   |
| clean-schema rerun                   | Blocked                                                                                           |
| `git diff --check`                   | Unavailable, exit 128: archive is not a Git repository                                            |
| Production `KASICASH_DB_MODE=memory` | Rejected before Nest construction                                                                 |
| Production arbitrary DB mode         | Rejected before Nest construction                                                                 |
| Production missing/`postgres` mode   | Attempted only PostgreSQL; connection retries timed out, no listen                                |
| Webhook 1.1 MiB/2 MiB probe          | HTTP 413 before controller; zero ingestion calls                                                  |
| AI prototype/getter probe            | Both malicious object forms accepted                                                              |
| Dashboard malformed-limit probe      | Scientific/huge forms accepted or silently coerced                                                |
| Local DST calculation probe          | Correct 23/25-hour boundaries for Auckland and New York transitions; not a PostgreSQL proof       |

CI configuration is materially improved: PostgreSQL 15, Node 22, audit/build/lint/text/unit/integration, migrations, smoke test, and strict `psql` output validation are present. There is no CI URL, job log, status, or commit SHA proving it ran.

# 9. Constitution assessment

| Section                     | Result                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| §1 Ledger legal record      | **Partial** — strong static DB design; PG proof absent and mutable proposals can alter what confirmation authorizes.               |
| §2 Money                    | **Pass statically** — string minor units, bigint calculations, explicit ZAR/USD/JPY/BHD scales; DB boundary execution blocked.     |
| §3 Multi-tenancy            | **Pass statically** — trusted route contexts and composite ledger FKs; adversarial PG tests blocked.                               |
| §4 AI boundaries            | **Partial** — AI/heuristic cannot directly post or supply figures, but proposal binding and object validation are incomplete.      |
| §5 Trust/input              | **Partial** — exact HMAC path exists; transport size can bypass durable classification.                                            |
| §6 Reliability              | **Partial** — claims, leases, idempotency, retry and DLQ are well designed; webhook boundary and alert rollback defects remain.    |
| §7 Schema/change management | **Partial** — one catalog, no synchronize, all 17 migrations have `up()` and `down()`; upgrade safety and round-trip are unproven. |
| §8 Testing/acceptance       | **Fail** — no real-PostgreSQL execution or green identifiable CI.                                                                  |
| §9 Scope discipline         | **Mostly pass** — financial reads are query-only/read-only and deferred work is documented.                                        |
| §10 Fail safe/provable      | **Partial** — most failure paths use bounded codes, but the migration, rate-clock and webhook boundaries do not fully fail safely. |

# 10. Ratings

| Area                   | Rating |
| ---------------------- | -----: |
| Accounting correctness |   8/10 |
| Database integrity     |   7/10 |
| Tenant isolation       |   8/10 |
| Security               |   7/10 |
| Ingestion reliability  |   7/10 |
| Read correctness       |   8/10 |
| Observability          |   7/10 |
| Testing                |   6/10 |
| Documentation          |   8/10 |
| Operability            |   5/10 |

# 11. Remaining production blockers

1. Produce a green PostgreSQL 15 CI run tied to an immutable commit and this archive’s contents.
2. Complete the full migration run/revert/run/revert-all/clean-rerun sequence.
3. Add and execute a legacy-data upgrade test for migration `1700000015000`.
4. Freeze and cryptographically/version-bind proposal economic facts to the confirmation prompt.
5. Unify webhook transport and application body limits and durably classify authenticated rejected bodies.
6. Move rate-window expiry entirely onto the PostgreSQL clock.
7. Preserve terminal alert ambiguity through supported downgrade paths.
8. Execute the missing concurrency, timezone/DST, currency-table, webhook-shape, privacy, and multi-instance test matrices.
9. Close documented production gates for managed secrets/rotation, penetration testing, SLOs, and production-like load/capacity evidence.

Until those named items are proven, KasiCash is **not ready for production**.
Round 3

You are the independent senior backend, accounting-systems, security, and
reliability reviewer for KasiCash. Review the attached full repository archive.
Do not trust its status documents or remediation claims; prove behavior from
code, migrations, tests, and commands you execute.

## Receipt Check

1. Confirm the archive extracts cleanly and identify the repository root.
2. Inventory all files. Explicitly confirm receipt of `package.json`,
   `package-lock.json`, `ENGINEERING_CONSTITUTION.md`, `src/`, `test/`,
   `.github/workflows/ci.yml`, all migrations through
   `1700000015000-RoundTwoIntegrityHardening.ts`, and the design/status/ADR/
   remediation documents.
3. Report missing, duplicated, generated, secret-bearing, or suspicious files
   before reviewing behavior.

## Governing Standard

Treat `ENGINEERING_CONSTITUTION.md` as binding. The ledger must remain the one
immutable, append-only, DB-balanced legal record; corrections are reversals;
money is bigint minor-unit strings; tenant identity is trusted server context;
AI proposes intent and never writes the ledger or invents figures; authenticated
webhook bytes are durable before processing; read services are read-only; all
important invariants are enforced and proven against real PostgreSQL.

## Round-Two Closure Audit

Start by independently reproducing or disproving every item in
`FULL_SYSTEM_REVIEW_ROUND2_REMEDIATION.md`:

1. **Production database containment**: try production startup with missing,
   `postgres`, `memory`, and arbitrary DB modes. Verify no synchronized/in-memory
   production path or `pg-mem` dependency exists and failure occurs before
   listen/database writes.
2. **Account classification race**: on PostgreSQL 15, use two connections and
   barriers around the first uncommitted entry. Attempt raw SQL and ORM changes
   to account `business_id`, `code`, and `type`, before and after first use.
   Verify all are rejected and report meaning cannot change.
3. **Raw webhook durability**: hit the real HTTP route with valid HMAC over
   invalid JSON, `null`, primitives, `{}`, non-array `entry`, malformed
   `changes/messages`, mixed valid/malformed content, a valid callback, replay,
   and invalid HMAC. Verify exact authenticated bytes are stored first and every
   invalid shape reaches terminal quarantine without financial processing.
4. **Sender ordering**: pause sequence-one insertion before commit while a YES
   or NO message inserts/processes on another connection. Verify the later
   message cannot overtake and exactly one legal proposal transition/post occurs.
5. **AI containment**: inject CLARIFY/out-of-scope payloads containing money,
   numbers, tenant IDs, instructions, hidden properties, getters/prototypes, and
   malformed types. Verify strict rejection or application-owned nonfinancial
   text, with no read widening and no write.
6. **Production dev surface**: prove `/dev/whatsapp/text` is absent from the
   production route graph and startup rejects the production flag even with a
   token.
7. **Alert ambiguity**: simulate provider acceptance followed by failures of
   both `SENT` and immediate uncertainty persistence. Recover the DB, run
   reconciliation, verify terminal `DELIVERY_UNCERTAIN`, then prove repeated
   dispatch never contacts the provider.
8. **Report bounds**: attack direct controller and service calls with multi-year
   ranges, huge/negative offsets, zero/huge limits, scientific notation,
   fractions, Infinity, unsafe integers, malformed dates, and DST boundaries.
9. **Timezone determinism**: run report, analytics, anomaly, and stored-instant
   assertions under UTC, Africa/Johannesburg, Pacific/Auckland, and at least one
   DST transition. Check no local time is labeled `Z`.
10. **Provenance and currency**: raw-insert malformed/uppercase/short hashes,
    unknown source types, missing WhatsApp source IDs, and unsupported currencies
    into every currency-bearing table. Test ZAR, USD, JPY, and BHD formatting and
    anomaly floors using bigint only.
11. **Privacy/config/CI**: capture all logs and CLI streams under injected phone,
    email, token, signature, DB credential, message, provider body, and money.
    Verify none leak. Confirm insecure cookie/cloud/dev settings fail at startup,
    CI cannot convert a `psql` failure to success, and LF/whitespace checks pass.

## Full Phases 1-10 Review

After round-two closure, review the entire system end to end:

- Ledger posting, zero-entry/balance/immutability/tenant constraints, idempotency,
  legal reversal and the full forged reversal matrix.
- Durable ingestion, exact-byte HMAC, replay authority, atomic fenced claims,
  lease expiry/heartbeat/finalize/fail races, sender ordering, retry/backoff/DLQ,
  and best-effort outbound effects.
- Transaction proposal creation, explicit same-tenant human confirmation, CAS
  races, duplicate messages, and proof parsing/AI cannot post directly.
- Reports, analytics, anomalies, conversational answers, and dashboard figure
  traceability to posted/reversed ledger rows; non-posted exclusion; no float
  money; no client recomputation; read-only transaction proof.
- Authentication/session lifecycle, rate limits, replay protection, every public
  route, manipulated IDs/tokens/headers, and one-principal-one-tenant isolation.
- Telemetry sanitization, truthful health/readiness, migration/recovery state,
  graceful shutdown with in-flight atomic claims, and tenant-scoped DLQ metadata.

Hunt specifically for alternate database paths, `synchronize: true`, hidden
ledger writes, mutation-on-read, cross-tenant access, fabricated figures, float
money, timezone ambiguity, replay gaps, duplicate side effects, swallowed errors,
unsafe defaults, secret/PII/money logging, and health checks that can lie.

## Required Execution

Use Node/npm versions compatible with the lockfile and run at minimum:

```bash
npm ci
npm run verify:text
npm run build
npm run lint
npm test -- --runInBand
npm run test:integration
npm audit --audit-level=moderate
```

Against PostgreSQL 15, execute the production catalog and prove:

```bash
npm run migration:run
npm run migration:revert
npm run migration:run
npm run migration:revert:all
```

Then rerun migrations and the integration suite on the clean schema. Include
command output, environment/runtime versions, commit/archive hash, and CI URL if
available. Do not call a declared test a passed test. If Docker/PostgreSQL is
unavailable, say exactly which proof remains blocked and keep the verdict gated.

## Output Format

1. Receipt check and environment.
2. Verdict: `Ready`, `Ready with conditions`, or `Not ready`.
3. Findings first, ordered Critical/High/Medium/Low, each with exploit/failure
   scenario, violated invariant, exact file/line evidence, remediation, and
   missing regression test.
4. Round-two closure table for C-01 through L-04: `Fixed`, `Partially fixed`, or
   `Not fixed`, backed by executed evidence.
5. Phase-by-phase assessment for Phases 1-10.
6. Public-route/tenant trace and financial-figure trace.
7. Migration round-trip, test, audit, hygiene, and CI evidence table.
8. Constitution section-by-section assessment.
9. Ratings out of 10 for accounting correctness, DB integrity, tenant isolation,
   security, ingestion reliability, read correctness, observability, testing,
   documentation, and operability.
10. Final production blockers. A production-ready verdict requires green real
    PostgreSQL tests and migrations from an identifiable clean revision.
