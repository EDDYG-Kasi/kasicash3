# Verdict: Not ready

Two Critical defects remain:

1. Production can boot with an ephemeral, synchronized `pg-mem` database that omits the migration/trigger catalog. I reproduced a successful production boot and then changed a posted entry from `100` to `999` through ORM; the update affected one row.
2. The Round 1 account-classification fix is vulnerable to a first-post/update race, allowing historical reports to be reclassified after posting.

There is also no green PostgreSQL 15 execution or successful migration round trip. This alone prevents a production-ready verdict; the defects below independently require remediation.

# Findings

## Critical

### C-01 — Production can bypass the entire migrated ledger-integrity schema

* Evidence: [src/app.module.ts:29,35,39](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/app.module.ts) selects `pg-mem` and `synchronize: true` solely from `KASICASH_DB_MODE=memory`, without rejecting `NODE_ENV=production`. The canonical migration catalog is only used on the other branch. Migration-only controls such as the rate-limit table are created at [src/migrations/1700000014000-SecurityAndNotificationHardening.ts:33](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000014000-SecurityAndNotificationHardening.ts).
* Reproduced scenario: with `NODE_ENV=production`, `KASICASH_DB_MODE=memory`, explicit cloud mode, token, and phone ID, the application initialized with `synchronize=true`; `transactions` existed, while `migrations` and `security_rate_limits` did not. After posting a balanced transaction, an ORM update changed a posted entry to `999`.
* Violated invariants: ledger immutability and DB-enforced balance, canonical migrations, production proof—Constitution §§1.2, 1.5, 7.1, 7.3, 8.2.
* Remediation: reject every production database mode except real PostgreSQL before module construction. Keep `pg-mem` in a test-only module that cannot be reached by the production bootstrap. Production must always load `KASICASH_ENTITIES` and `KASICASH_MIGRATIONS`.
* Missing regression test: boot the actual production module under every database-mode value; assert memory/unknown modes fail before listening, and assert raw SQL/ORM mutation of a posted entry is rejected in every allowed production mode.

### C-02 — Historical account classification remains raceable

* Evidence: the trigger at [1700000011000-LedgerClassificationAndReversalIntegrity.ts:19,22,35](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000011000-LedgerClassificationAndReversalIntegrity.ts) permits changes when its transaction snapshot cannot yet see a referencing entry. Reports join current account code/type at [reports.service.ts:103,113,176,184](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/reports/reports.service.ts). The regression test only performs sequential ORM changes at [test/ledger.e2e-spec.ts:140,145,151](sandbox:/workspace/scratch/b1261b758788/round2-review/api/test/ledger.e2e-spec.ts).
* Failure scenario: transaction A starts a `code`/`type` update before the first entry is visible. Its trigger sees no entry and permits the update. Transaction B inserts the first entry and commits; PostgreSQL’s FK key-share lock is compatible with a non-key account update. A then commits. Existing ledger entries are subsequently interpreted through the new code/type.
* Violated invariants: immutable legal history, DB-enforced economic meaning, traceable reports—§§1.1, 1.2, 7.3.
* Remediation: make `business_id`, `code`, and `type` unconditionally immutable after account creation, with corrections represented by a replacement account; alternatively introduce immutable versioned classification referenced directly by entries.
* Missing regression test: two independent PostgreSQL connections with barriers around the first entry and concurrent account update, covering raw SQL and ORM changes to all three fields and comparing reports before and after commit.

## High

### H-01 — Signed malformed webhook bytes are still not durably quarantined

* Evidence: Nest parses `@Body()` before the controller at [whatsapp.controller.ts:55,57](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/whatsapp.controller.ts); durable storage begins only inside the service call at [whatsapp.controller.ts:83](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/whatsapp.controller.ts). The service assumes iterable arrays at [ingestion.service.ts:118,119,123](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/ingestion.service.ts) and marks `{}` accepted at [ingestion.service.ts:161,164](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/ingestion.service.ts).
* Reproduced scenarios:

  * Valid HMAC over `{"entry":[` returned HTTP 400 with `Unexpected end of JSON input`; `webhook_deliveries` remained empty.
  * `{}` was finalized as `ACCEPTED` with zero messages.
  * `{"entry":{}}` threw `TypeError: object is not iterable` and left the delivery `RECEIVED`.
  * A pre-existing live replay row causes [whatsapp.controller.ts:80](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/whatsapp.controller.ts) to acknowledge without first establishing a delivery record.
* Violated invariants: exact-byte authentication, durable-before-processing, no silent loss—§§5.1, 5.2, 6.1, 6.3.
* Remediation: use a route-specific raw-body handler. Verify HMAC over the buffer, insert the buffer, and only then parse JSON and validate a strict schema. Every parse/schema failure must transition to terminal `QUARANTINED`. Make `webhook_deliveries` the authoritative replay/idempotency record.
* Missing regression test: real HTTP tests for invalid JSON, `null`, primitives, missing/non-array `entry`, non-array `changes/messages`, partial valid/malformed payloads, replay-row manipulation, and redelivery after every crash point.

### H-02 — Sender ordering still loses confirmations behind uncommitted earlier messages

* Evidence: inbound insertion commits independently at [ingestion.service.ts:235,250](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/ingestion.service.ts). The claim excludes only visible earlier rows at [ingestion.service.ts:413,425,429](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/ingestion.service.ts). The advisory lock starts later, at proposal processing, at [parsing.service.ts:221,234,237](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/parsing/parsing.service.ts). The test precommits both rows at [test/ledger.e2e-spec.ts:903,912,928](sandbox:/workspace/scratch/b1261b758788/round2-review/api/test/ledger.e2e-spec.ts).
* Failure scenario: proposal A receives sequence 1 but remains uncommitted. YES B receives sequence 2, commits, claims, cannot see A, and becomes `NO_PENDING_CONFIRMATION`. A then commits and creates a pending proposal. The human’s explicit confirmation has been lost.
* Violated invariants: mandatory human confirmation and no silent message loss—§§4.1, 6.1, 6.2.
* Remediation: serialize durable insertion and claiming per sender, for example with a per-sender PostgreSQL advisory lock spanning insertion/order selection, or a queue consumer that selects the minimum committed sequence and cannot be invoked directly by row ID.
* Missing regression test: two connections where sequence 1 is paused before commit while sequence 2 commits and attempts processing, plus simultaneous proposal/YES/NO with assertions for one legal proposal transition and at most one ledger post.

### H-03 — A resolver can inject an arbitrary financial figure through `CLARIFY`

* Evidence: the resolver contract allows free-form `question` at [conversational-query.resolver.ts:23,25](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/conversational-query/conversational-query.resolver.ts). It is copied to the reply at [conversational-query.service.ts:109,116,117](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/conversational-query/conversational-query.service.ts); `sanitizeReply` only normalizes whitespace and length at [conversational-query.service.ts:483,484](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/conversational-query/conversational-query.service.ts).
* Reproduced scenario: a resolver returning `{kind:"CLARIFY", question:"Your balance is ZAR 999,999.99"}` produced that exact financial reply.
* Violated invariants: AI may resolve intent but must not produce figures or unverified facts—§§4.2, 4.3, 4.4.
* Remediation: replace free-form model prose with a clarification enum and application-owned templates. Reject unexpected resolver fields and any free-form numeric/money-bearing output.
* Missing regression test: malicious `CLARIFY` output containing currencies, amounts, tenant identifiers, prompt-injection text, and hidden/unexpected properties.

### H-04 — The synthetic WhatsApp write surface remains enabled in production

* Evidence: `DevController` is always registered at [ingestion.module.ts:25](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/ingestion.module.ts). It checks only a flag and token at [dev.controller.ts:42,45,46](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/dev.controller.ts), then accepts the caller-selected phone at [dev.controller.ts:50,51,54](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/dev.controller.ts). There is no production-mode rejection.
* Exploit scenario: a production deployment accidentally enables the flag. Anyone obtaining the shared dev token can select another trader’s phone, submit a proposal, and then submit YES under that identity.
* Violated invariants: tenant identity must come from trusted server context; external input may not select tenant scope—§§3.1, 3.2, 5.1.
* Remediation: fail startup when dev tools are enabled in production and omit the controller entirely from the production module graph. Use explicit test/local modules.
* Missing regression test: production boot with the flag/token must fail, and the route must remain absent under every production configuration.

## Medium

### M-01 — Post-dispatch alert ambiguity is not guaranteed to reach a terminal state

* Evidence: the provider send and `SENT` persistence occur at [anomaly.service.ts:141,142](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/anomaly/anomaly.service.ts). The catch then performs another database write at [anomaly.service.ts:149,150](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/anomaly/anomaly.service.ts). The terminal update is at [anomaly.service.ts:281,285,289](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/anomaly/anomaly.service.ts).
* Failure scenario: the provider accepts the send, then the database becomes unavailable. Both `markAlertSent` and `markAlertUncertain` fail. The method throws and the row remains `SENDING` with `dispatch_started_at`, not explicit `DELIVERY_UNCERTAIN`.
* Violated invariants: recoverable, contained side effects and truthful operational state—§§6.3, 6.4.
* Remediation: add a reconciliation worker that terminalizes started-but-unresolved sends without resending, plus provider idempotency keys/message receipts where supported.
* Missing regression test: provider succeeds, both post-send database writes fail, database recovers, reconciliation marks the row uncertain, and subsequent dispatch never calls the provider again.

### M-02 — Direct report routes retain unbounded date spans and offsets

* Evidence: request values are converted at [reports.controller.ts:52,53,73,74](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/reports/reports.controller.ts). Period validation checks ordering but not span at [reports.math.ts:86,98](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/reports/reports.math.ts); offset has no cap at [reports.service.ts:436,439](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/reports/reports.service.ts). Dashboard-only caps exist at [dashboard.service.ts:22,23,288,316](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/dashboard/dashboard.service.ts).
* Failure scenario: an authenticated user requests decades of data or an extreme offset directly through `/reports`, causing expensive scans/sorts despite dashboard limits.
* Violated invariants: untrusted input must be validated against sane ranges—§4.3 and §5.1.
* Remediation: enforce common period/offset limits inside `ReportsService`, not only controllers or dashboard adapters.
* Missing regression test: direct report API and service calls with multi-year periods, huge offsets, `Infinity`, scientific notation, and malformed numeric values.

### M-03 — Anomaly timestamps depend on the database session timezone while being labeled UTC

* Evidence: [anomaly.service.ts:348](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/anomaly/anomaly.service.ts) formats `t.occurred_at` in the current session timezone and appends a literal `Z`.
* Failure scenario: under `Pacific/Auckland`, the output represents local time but claims UTC. The same instant produces different anomaly payloads/keys or misleading operator evidence across instances.
* Violated invariants: deterministic, trustworthy and traceable financial read output—§§2.4, 10.1.
* Remediation: return the timestamptz as a typed instant or explicitly use `timezone('UTC', t.occurred_at)` before formatting.
* Missing regression test: identical reports, anomaly candidates, and stored instants under UTC, Africa/Johannesburg, and a DST transition in a DST-observing timezone.

### M-04 — Ledger provenance constraints accept arbitrary nonblank “hashes” and source types

* Evidence: the database check at [1700000003000-LedgerHardening.ts:145,146,155,156](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000003000-LedgerHardening.ts) requires only nonblank strings. Application validation at [ledger.service.ts:50,52](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ledger/ledger.service.ts) is equally permissive. Integration fixtures use values such as `H` at [test/ledger.e2e-spec.ts:358,362](sandbox:/workspace/scratch/b1261b758788/round2-review/api/test/ledger.e2e-spec.ts).
* Failure scenario: raw SQL or a faulty internal caller commits an external transaction with `source_type='ANYTHING'` and `source_payload_hash='H'`, defeating cryptographic provenance and weakening idempotency reconciliation.
* Violated invariants: trustworthy, traceable legal record and database-enforceable provenance—§§1.1, 7.3.
* Remediation: enforce a source-type allowlist and exact lowercase SHA-256 format for external records; require source-specific identifiers where applicable.
* Missing regression test: raw and ORM attempts with short, uppercase, malformed, blank, unknown-source, and missing hashes.

### M-05 — The supported-currency contract is not enforced across all currency-bearing tables

* Evidence: ledger transactions have an allowlist at [1700000011000-LedgerClassificationAndReversalIntegrity.ts:13,15](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000011000-LedgerClassificationAndReversalIntegrity.ts), but proposals accept any three uppercase letters at [1700000007000-TransactionProposals.ts:36,37](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000007000-TransactionProposals.ts), principals do the same at [1700000010000-SecurityAuth.ts:15,25](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000010000-SecurityAuth.ts), and anomaly alerts have no currency constraint at [1700000009000-AnomalyAlerts.ts:18](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000009000-AnomalyAlerts.ts). Anomaly absolute floors are currency-independent at [anomaly.rules.ts:40,44,49,50](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/anomaly/anomaly.rules.ts).
* Failure scenario: raw SQL creates an `AAA` principal/proposal or unsupported alert row; authenticated reads then fail closed inconsistently. The same `50000` threshold means JPY 50,000, ZAR 500.00 and BHD 50.000.
* Violated invariants: every amount must be currency-aware; unsupported currencies must fail at the database boundary—§2.3.
* Remediation: use one database currency domain/reference table across all currency columns and configure anomaly thresholds per supported currency/business.
* Missing regression test: raw inserts into every currency-bearing table for unsupported codes, plus ZAR/USD/JPY/BHD anomaly threshold and formatting cases.

### M-06 — Telemetry privacy is not universal

* Evidence: the development client logs the last four phone digits at [whatsapp.client.ts:13,15,58,60](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/whatsapp.client.ts). The migration CLI prints raw exception objects at [database/migrate.ts:27,28](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/database/migrate.ts), bypassing the telemetry allowlist.
* Failure scenario: phone fragments enter local/central logs, or a raw driver exception exposes connection/query detail during migration failure.
* Violated invariants: phone numbers, secrets, and private content must never be logged; errors must be bounded and sanitized—§5.4.
* Remediation: remove recipient fragments entirely and make CLI failures emit only bounded error codes.
* Missing regression test: capture every logger/CLI stream while injecting phone, email, credentials, signatures, message bodies, provider bodies, and monetary values.

## Low

### L-01 — Production cookie misconfiguration is checked after creating a session

* Evidence: login inserts the session at [auth.service.ts:85,87](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/auth/auth.service.ts); the controller checks cookie security afterward at [auth.controller.ts:49,55](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/auth/auth.controller.ts). The production rejection is at [auth.service.ts:154,157,158](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/auth/auth.service.ts).
* Failure scenario: production boots with insecure-cookie configuration; each valid login creates an orphan session and then returns an error.
* Violated invariant: fail safe and expose truthful operability—§10.2.
* Remediation: validate configuration during startup, before database writes or listening.
* Missing regression test: production bootstrap with every cookie setting, asserting insecure configuration fails before a session can be inserted.

### L-02 — CI’s final migration-count assertion can report success when `psql` fails

* Evidence: [.github/workflows/ci.yml:56,57,59](sandbox:/workspace/scratch/b1261b758788/round2-review/api/.github/workflows/ci.yml) converts any `psql` failure to `0`, which is the expected success value.
* Failure scenario: PostgreSQL becomes unavailable during the final inspection and the job prints zero remaining migrations.
* Violated invariant: tests must prove behavior rather than turn inspection failure into success—§8.1.
* Remediation: remove `|| echo 0`; let `psql` fail and validate numeric output separately.
* Missing regression test: CI script test where `psql` exits nonzero.

### L-03 — Archive line endings contradict repository policy

* Evidence: [.gitattributes:3,6,7](sandbox:/workspace/scratch/b1261b758788/round2-review/api/.gitattributes) mandates LF. The ZIP contains CRLF in six tracked-looking files and trailing whitespace at [1700000000000-ImmutabilityTriggers.ts:41,68](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/migrations/1700000000000-ImmutabilityTriggers.ts).
* Failure scenario: checkout/packaging churn obscures material diffs and makes clean-snapshot verification platform-dependent.
* Violated invariant: independent review must be able to reproduce the committed snapshot—§8.4.
* Remediation: normalize before packaging and package from a clean Git checkout.
* Missing regression test: archive-level LF/trailing-whitespace validation, not merely worktree normalization after checkout.

### L-04 — README smoke instructions no longer authenticate to the dev endpoint

* Evidence: [README.md:44,47,57,59](sandbox:/workspace/scratch/b1261b758788/round2-review/api/README.md) enables dev tools and calls the endpoint without configuring or sending the token required by [dev.controller.ts:35,45,46](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/ingestion/dev.controller.ts).
* Failure scenario: the documented smoke test returns 403; in memory mode it currently returns 500 because the migration-only rate table is absent.
* Violated invariant: claimed guarantees and operating procedures must be traceable and reproducible—§8.4.
* Remediation: document the token/header and explicitly prohibit production/memory misuse, or provide a tested local-only script.
* Missing regression test: executable README smoke test in CI.

# Receipt report

| Check                           | Result                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ZIP readability                 | Pass: `unzip -t` succeeded                                                                                                               |
| File count                      | 159 regular files, 23 directory entries, 182 ZIP entries total                                                                           |
| Constitution                    | Present and readable                                                                                                                     |
| Round 1 findings                | Present and readable                                                                                                                     |
| Remediation map                 | Present and readable                                                                                                                     |
| Source                          | 112 TypeScript files across all Phase 1–10 modules                                                                                       |
| Migrations                      | 16 migrations, from `1699999999000` through `1700000014000`                                                                              |
| Tests                           | 26 unit spec files and 8 PostgreSQL integration suites                                                                                   |
| Package manifests               | `package.json` and `package-lock.json` present                                                                                           |
| CI                              | `.github/workflows/ci.yml` present; configured for PostgreSQL 15                                                                         |
| System documents                | Schema, ADRs, runbook, roadmap, changelog, status, tech debt and review/design documents present                                         |
| Missing/unreadable              | None among requested artifacts                                                                                                           |
| Duplicate archive paths/content | None found                                                                                                                               |
| Generated-only artifacts        | No `dist`, `coverage`, `node_modules`, or compiled-only source                                                                           |
| Secrets                         | No `.env`, private keys, access tokens, or credential files found; only `.env.example` and documented local dummy PostgreSQL credentials |
| Suspicious packaging            | No `.git`, so append-only history and committed-snapshot cleanliness cannot be proven                                                    |
| Line endings                    | CRLF in `eslint.config.mjs`, `nest-cli.json`, `package.json`, `test/jest-e2e.json`, `tsconfig.build.json`, `tsconfig.json`               |
| Trailing whitespace             | `1700000000000-ImmutabilityTriggers.ts` lines 41 and 68                                                                                  |

# Commands and CI evidence

Local runtime was Node 24.14.0/npm 11.9.0; CI declares Node 22.

| Command                            | Result                                                                                                                                                                                                          | Classification             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `npm ci`                           | Pass after overriding the injected unwritable npm cache to `/tmp`; 856 packages installed                                                                                                                       | Pass                       |
| `npm audit --audit-level=moderate` | 0 vulnerabilities                                                                                                                                                                                               | Pass                       |
| `npm run build`                    | Exit 0                                                                                                                                                                                                          | Pass                       |
| `npm run lint`                     | Exit 0                                                                                                                                                                                                          | Pass                       |
| `npm test -- --runInBand`          | 26 suites, 157 tests passed                                                                                                                                                                                     | Pass                       |
| `npm run test:integration`         | All 8 suites aborted before assertions: no Docker/Podman/container runtime                                                                                                                                      | Environment failure        |
| `npm run migration:run`            | `ECONNREFUSED` on PostgreSQL port 5432                                                                                                                                                                          | Environment failure        |
| `npm run migration:revert`         | `ECONNREFUSED`                                                                                                                                                                                                  | Environment failure        |
| second `npm run migration:run`     | `ECONNREFUSED`                                                                                                                                                                                                  | Environment failure        |
| `npm run migration:revert:all`     | `ECONNREFUSED`                                                                                                                                                                                                  | Environment failure        |
| `git diff --check`                 | Exit 129: archive is not a Git repository                                                                                                                                                                       | Evidence/packaging failure |
| Independent whitespace scan        | Six CRLF files and two trailing-whitespace lines                                                                                                                                                                | Fail                       |
| CI definition                      | PostgreSQL 15 service, unit/integration and migration commands are declared at [.github/workflows/ci.yml:12,14,46,47,48,51](sandbox:/workspace/scratch/b1261b758788/round2-review/api/.github/workflows/ci.yml) | Definition present         |
| Actual CI run                      | No run URL, logs, commit SHA or status artifact in the archive                                                                                                                                                  | Missing evidence           |

The production app, CLI, and integration tests share the canonical PostgreSQL catalog at [database-options.ts:30,44,63,73,74](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/database/database-options.ts), [data-source.ts:4,5](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/database/data-source.ts), and [test/migrations.e2e-spec.ts:24,25,36,41,50](sandbox:/workspace/scratch/b1261b758788/round2-review/api/test/migrations.e2e-spec.ts). The production-memory escape in C-01 is the exception.

All sixteen `up()` and `down()` implementations were inspected. Their static dependency ordering is coherent, but none of the `down()` implementations was executed here.

# Round 1 closure table

| Round 1 item                    | Status              | Round 2 result                                                                           |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| C1 account classification       | Partially fixed     | Sequential updates blocked; first-reference race remains                                 |
| C2 reversal integrity           | Partially fixed     | Static constraints cover specified states; real PostgreSQL execution unavailable         |
| H1 readiness/migrations         | Partially fixed     | Readiness code is fail-closed, but production memory bypass and no PG evidence           |
| H2 lease fencing                | Partially fixed     | CAS predicates exist; late failure/heartbeat attack matrix not executed                  |
| H3 sender/proposal ordering     | Not fixed           | Uncommitted-earlier-message race remains                                                 |
| H4 alert dispatch               | Partially fixed     | Automatic duplicate retry blocked; terminal persistence can fail                         |
| H5 rate limiting                | Partially fixed     | Shared hashed atomic code exists; full two-instance/header/expiry tests absent           |
| H6 timezones                    | Partially fixed     | `timestamptz` migration exists; anomaly UTC labeling bug and insufficient DST proof      |
| H7 currencies                   | Partially fixed     | Ledger/report registry fixed; other DB tables and anomaly thresholds remain inconsistent |
| H8 telemetry privacy            | Partially fixed     | Raw error columns/allowlist improved; phone fragment and raw CLI exceptions remain       |
| H9 malformed webhook durability | Not fixed           | Invalid JSON and malformed container shapes are lost/stuck/misclassified                 |
| H10 WhatsApp fail-closed        | Fixed               | Production requires cloud mode/token/phone ID; provider body is not exposed              |
| Reversal tenant lookup          | Fixed               | Lookup includes trusted `businessId`                                                     |
| Dashboard bounds                | Fixed               | Dashboard capped at 366 days/10,000 offset; direct reports remain unbounded              |
| Replay expiry refresh           | Fixed               | Expired rows are refreshed                                                               |
| Shutdown timing                 | Fixed               | Draining and in-flight tracking present                                                  |
| Unknown-login timing            | Fixed               | Dummy password hash path present                                                         |
| Secure cookies                  | Partially fixed     | Fails closed per request, but not at startup and leaves sessions                         |
| Parser signed-bigint bound      | Fixed               | BigInt parsing and `INT64_MAX` checks present                                            |
| Dependency advisories           | Fixed               | Independent audit returned zero                                                          |
| Line-ending churn               | Not fixed           | Six CRLF files and two whitespace defects                                                |
| Mutating lint/clean CI          | Fixed in definition | Lint is non-mutating and CI declares clean-tree checks; archive lacks Git evidence       |

# Public route and tenant trace

| Route family                    | Boundary                             | Result                                                                                          |
| ------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `GET /`                         | Public, static service status        | No financial data                                                                               |
| `/health`, `/ready`, `/metrics` | Public operational endpoints         | No tenant data observed; readiness is fail-closed in PostgreSQL mode                            |
| `POST /auth/login`              | Public, IP and account rate limits   | Principal selected server-side from credentials                                                 |
| `/auth/me`, `/auth/logout`      | `AuthGuard`                          | Trusted session principal                                                                       |
| `/reports/*`                    | Class-level `AuthGuard`              | `businessId`, currency and timezone come from principal; account ID additionally tenant-checked |
| `/dashboard/*`                  | `AuthGuard` + `DashboardTenantGuard` | Tenant constructed from authenticated principal                                                 |
| `/ops/dead-letter`              | `AuthGuard`                          | Query constrained to principal `businessId`                                                     |
| `GET /webhooks/whatsapp`        | Verify token + IP rate limit         | No tenant read                                                                                  |
| `POST /webhooks/whatsapp`       | Raw HMAC + rate limit                | Tenant later resolved from phone; malformed durability fails                                    |
| `POST /dev/whatsapp/text`       | Shared token only                    | Production-active caller-selected phone: High finding H-04                                      |

There is no public ledger, reversal, alert-dispatch, or direct analytics-write controller.

# Financial-figure trace

| Consumer                   | Source                                                                  | Assessment                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reports                    | `transactions` + `entries` + `accounts`, tenant/currency/status filters | Deterministic, but live account classification creates C-02                                                                                                |
| Analytics                  | Same posted ledger, read-only transactions, explicit timezone buckets   | No financial writes; core arithmetic remains SQL numeric/BigInt                                                                                            |
| Anomaly detection          | Analytics plus posted non-reversal expense-entry query                  | Ledger-derived, but timestamp and per-currency threshold defects remain                                                                                    |
| Conversational answers     | `ReportsService` DTOs                                                   | Correct for financial intents; free-form `CLARIFY` bypasses this                                                                                           |
| Dashboard                  | Server report/analytics DTOs                                            | No client financial recomputation; `toFixed` is used only for nonfinancial chart percentages                                                               |
| Transaction proposal reply | Deterministic parser/user amount                                        | Proposed before posting as intended; post acknowledgment uses proposal amount rather than rereading entries, relying on provenance/idempotency correctness |

The money sweep found no `parseFloat` or floating-point money arithmetic. ZAR/USD 2-decimal, JPY 0-decimal and BHD 3-decimal formatting is implemented with BigInt at [reports.math.ts:122,126,130,134,138](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/reports/reports.math.ts). The only `toFixed` is chart width formatting at [dashboard.frontend.ts:370,372](sandbox:/workspace/scratch/b1261b758788/round2-review/api/src/dashboard/dashboard.frontend.ts).

# Constitution assessment

| Invariants                                 | Status                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1.1 single legal ledger                    | Pass in intended PostgreSQL path                                                                      |
| 1.2 append-only immutable ledger           | Fail: production-memory bypass and account race                                                       |
| 1.3 reversal-only corrections              | Partial: strong static constraints, no PG execution                                                   |
| 1.4 lifecycle/non-empty                    | Partial: static DB controls, bypassed in memory mode                                                  |
| 1.5 DB double-entry                        | Partial: static control, no PG proof and production-memory bypass                                     |
| 2.1 integer-string money                   | Partial: intended paths use BigInt strings; memory production returned bigint as number               |
| 2.2 presentation-only formatting           | Pass                                                                                                  |
| 2.3 currency awareness                     | Fail: fragmented DB constraints and anomaly thresholds                                                |
| 2.4 explicit deterministic rounding        | Pass; no rounding path found                                                                          |
| 3.1 every read/write one tenant            | Fail at dev route; normal authenticated routes pass                                                   |
| 3.2 trusted tenant identity                | Fail at production-active dev route                                                                   |
| 3.3 structural cross-tenant prevention     | Partial pending PostgreSQL execution                                                                  |
| 4.1 AI proposes/human confirms             | Partial: normal flow complies, ordering can discard the confirmation                                  |
| 4.2 AI never produces figures              | Fail through free-form `CLARIFY`                                                                      |
| 4.3 validate AI output                     | Fail for free-form clarification                                                                      |
| 4.4 no unverified figures                  | Fail through free-form clarification                                                                  |
| 5.1 all input untrusted                    | Fail for webhook container shapes and dev phone identity                                              |
| 5.2 raw-byte HMAC                          | Fail for invalid JSON because parsing precedes controller verification/persistence                    |
| 5.3 prompt-injection containment           | Pass for the current heuristic resolver                                                               |
| 5.4 telemetry privacy                      | Fail for phone fragments/raw CLI exceptions                                                           |
| 6.1 no message silently lost               | Fail for invalid/malformed webhook cases and sender race                                              |
| 6.2 idempotent processing/replies          | Partial                                                                                               |
| 6.3 recoverable failures/raw preservation  | Partial; only parse-valid malformed structures are quarantined                                        |
| 6.4 side effects do not corrupt ledger     | Pass                                                                                                  |
| 6.5 fast acknowledgement                   | Pass for well-formed callbacks                                                                        |
| 7.1 ordered migrations/no real synchronize | Fail: production can select synchronized memory DB                                                    |
| 7.2 append-only, reversible migrations     | Unproven without Git history or round trip                                                            |
| 7.3 DB-enforceable invariants in DB        | Fail: production bypass, classification race, weak provenance/currency checks                         |
| 8.1 behavior proven by tests               | Fail for the named adversarial gaps                                                                   |
| 8.2 real-DB invariant proof                | Fail: no PostgreSQL execution                                                                         |
| 8.3 green full CI                          | Fail: no actual CI evidence                                                                           |
| 8.4 independent traceability               | Partial: code is traceable, Git/CI evidence absent                                                    |
| 9.1 read paths do not write/confirm flow   | Pass for normal application paths                                                                     |
| 9.2 deferred work documented               | Pass                                                                                                  |
| 9.3 correctness over breadth               | Fail overall because production-bypass and durability risks remain                                    |
| 10 fail-safe decision principles           | Partial; several boundaries fail closed, but production DB mode and malformed webhook behavior do not |

# Phase-by-phase assessment

| Phase                          | Assessment           | Main reason                                                                                                        |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1 — Ledger core                | Fail                 | Production-memory bypass and account-classification race                                                           |
| 2 — Ingestion                  | Fail                 | Invalid/malformed webhooks not durably quarantined                                                                 |
| 3 — Confirm-then-post          | Fail                 | Uncommitted sender-order race                                                                                      |
| 4 — Reports                    | Partial              | Ledger-derived and tenant-scoped; direct input bounds absent                                                       |
| 5 — Conversational queries     | Fail                 | Free-form resolver clarification can fabricate figures                                                             |
| 6 — Analytics                  | Partial              | Read-only and BigInt-safe; required PostgreSQL/DST proof absent                                                    |
| 7 — Anomalies/alerts           | Partial              | Ledger-derived; timestamp, currency-threshold and terminal dispatch gaps                                           |
| 8 — Dashboard                  | Pass at its boundary | Authenticated tenant context, bounded inputs, no client financial recomputation                                    |
| 9 — Auth/security              | Partial              | Principal-derived normal routes and shared rate limiter; dev route and startup validation gaps                     |
| 10 — Observability/operability | Partial              | Readiness and privacy controls improved; incomplete privacy, no real PG/CI evidence or durable operational backend |

# Remaining test gaps and production gates

Required regression work:

* Production configuration matrix proving memory/dev modes cannot boot.
* Real PostgreSQL account-classification race with report comparison.
* Sender sequence race with uncommitted earlier inserts.
* Invalid-JSON and complete malformed-webhook schema matrix at the real HTTP boundary.
* Lease A/B tests for late finalize, failure, heartbeat and reply suppression.
* Provider-success/database-outage alert reconciliation.
* Two-instance rate tests covering separate IP/account limits, forwarded headers, expiry, counter races and fallback cap.
* UTC/non-UTC/DST tests for reports, analytics, anomalies and stored instant round trips.
* Raw database currency rejection across every currency column.
* End-to-end privacy capture across logs, metrics, readiness, DLQ, persisted errors and CLI output.
* Full reversal attack matrix and legal service reversal on PostgreSQL 15.
* Successful `run → revert → run → revert:all` using the production CLI/catalog.

Operational gates already acknowledged in the repository also remain: managed secrets and rotation, TLS/proxy review, backup/restore drill, load baseline, SLOs/alerts, centralized telemetry, independent penetration test, and provider delivery receipts.

# Ratings

| Category               | Rating |
| ---------------------- | -----: |
| Accounting correctness |   4/10 |
| Database integrity     |   4/10 |
| Tenant isolation       |   5/10 |
| Security               |   5/10 |
| Ingestion reliability  |   3/10 |
| Read-side correctness  |   6/10 |
| Observability          |   5/10 |
| Testing                |   5/10 |
| Documentation          |   7/10 |
| Operability            |   3/10 |

Final verdict: **Not ready**. The named Critical and High defects must be fixed, followed by a green real-PostgreSQL 15 CI run and successful full migration round trip from an identifiable clean commit.
