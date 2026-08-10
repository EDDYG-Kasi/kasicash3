# Full-System Review Round Two Remediation

This document maps every round-two finding to its implementation and regression
evidence. It is a receipt, not a production-readiness claim. A green PostgreSQL
15 CI run and full migration round trip are still required.

## Critical

| Finding | Resolution | Evidence |
|---|---|---|
| C-01 production memory DB bypass | Removed the `pg-mem` runtime branch and dependency. `AppModule` always builds PostgreSQL options with `synchronize: false`; runtime validation rejects any non-Postgres mode before Nest construction. | `src/app.module.ts`, `src/config/runtime-config.ts`, `src/config/runtime-config.spec.ts`, `src/database/database-options.ts`, `package.json`, `package-lock.json` |
| C-02 first-entry account classification race | Migration `1700000015000` makes account `business_id`, `code`, and `type` unconditionally immutable. Corrections require replacement accounts. | `src/migrations/1700000015000-RoundTwoIntegrityHardening.ts`; sequential, pre-reference, and two-connection tests in `test/ledger.e2e-spec.ts` |

## High

| Finding | Resolution | Evidence |
|---|---|---|
| H-01 signed malformed webhook loss | The webhook route receives a raw Buffer. HMAC verification and exact-byte durable insertion occur before JSON parsing. Strict schema failures finalize as `QUARANTINED`; durable deliveries are replay authority. | `src/main.ts`, `src/ingestion/whatsapp.controller.ts`, `src/ingestion/ingestion.service.ts`, unit cases in `ingestion.service.spec.ts`, real HTTP matrix in `test/webhook.e2e-spec.ts` |
| H-02 sender insertion/confirmation race | A per-sender PostgreSQL transaction advisory lock now spans insertion and monotonic sequence assignment. Claiming retains earlier-message exclusion and proposal transitions remain serialized. | `src/ingestion/ingestion.service.ts`, two-connection insertion barrier in `test/ledger.e2e-spec.ts` |
| H-03 free-form AI financial clarification | Resolver output is strict `unknown` input. Clarification and out-of-scope results use enums rendered by application-owned templates; unexpected fields fail closed. | `src/conversational-query/conversational-query.resolver.ts`, `conversational-query.service.ts`, malicious invented-figure unit test |
| H-04 production dev write route | Runtime validation rejects `KASICASH_DEV_TOOLS=true` in production, and `DevController` is omitted from the production module graph. | `src/config/runtime-config.ts`, `src/ingestion/ingestion.module.ts`, `runtime-config.spec.ts`, `whatsapp.client.spec.ts` |

## Medium

| Finding | Resolution | Evidence |
|---|---|---|
| M-01 unresolved post-dispatch state | Dispatch-started alerts are never automatically resent. Immediate failures attempt terminal uncertainty; a reconciliation worker changes stale started `SENDING` rows to `DELIVERY_UNCERTAIN` without provider calls. | `src/anomaly/anomaly.service.ts`, `anomaly-reconciliation.service.ts` and both specs |
| M-02 unbounded direct reports | The shared report period rejects more than 366 local days. Service pagination enforces limit 1-200 and offset 0-10,000 before opening a query runner. HTTP parsing accepts only safe base-10 integers. | `src/reports/reports.math.ts`, `reports.service.ts`, `reports.controller.ts` and specs |
| M-03 session-dependent anomaly time | Candidate SQL explicitly converts `timestamptz` through UTC before formatting. | `src/anomaly/anomaly.service.ts`, SQL assertion in its unit spec, non-UTC database session case in `test/anomaly.e2e-spec.ts` |
| M-04 weak provenance | App validation and migration constraints allowlist `SYSTEM`, `WHATSAPP`, `API`, and `WEB`; external hashes must be lowercase SHA-256; SYSTEM has no hash; WhatsApp requires a source message ID. | `src/ledger/ledger.service.ts`, migration `1700000015000`, unit and raw-SQL ledger tests |
| M-05 fragmented currency contract | `supported_currencies` is referenced by transactions, proposals, principals, and anomaly alerts. It stores scales and provisional bigint anomaly floors for ZAR/USD/JPY/BHD, loaded in the read-only detection transaction. | migration `1700000015000`, `src/anomaly/anomaly.service.ts`, migration/ledger/anomaly tests |
| M-06 privacy gaps | Development delivery logs contain neither recipient nor message fragments. Migration failures emit a bounded code only. | `src/ingestion/whatsapp.client.ts` and spec; `src/database/migrate.ts` |

## Low

| Finding | Resolution | Evidence |
|---|---|---|
| L-01 late cookie validation | Production cookie and complete WhatsApp configuration are validated before Nest/DB startup. | `src/main.ts`, `src/config/runtime-config.ts` and spec |
| L-02 CI masks `psql` failure | Removed `|| echo 0`; the command must succeed and output must be numeric zero. | `.github/workflows/ci.yml` |
| L-03 line-ending/whitespace drift | Added LF policy and executable scan/fix tool; CI runs the scan. | `.gitattributes`, `scripts/verify-text-files.mjs`, `npm run verify:text` |
| L-04 misleading smoke instructions | README and CI smoke configure the dev token, send its header, assert the JSON response, and use PostgreSQL only. | `README.md`, `.env.example`, `.github/workflows/ci.yml` |

## Verification On 2026-08-03

- Build: pass.
- ESLint: pass.
- Unit tests: 28 suites, 172 tests, all pass.
- Text hygiene: pass.
- `pg-mem` runtime/dependency search: no matches.
- Testcontainers integration: 9 suites and 60 tests discovered, but setup is
  blocked because this workstation exposes no working Docker/Podman/WSL
  container runtime. No PostgreSQL integration test is represented as passed.

The next independent reviewer must run CI against PostgreSQL 15, including
`migration:run -> migration:revert -> migration:run -> migration:revert:all`,
before changing the verdict to production-ready.
