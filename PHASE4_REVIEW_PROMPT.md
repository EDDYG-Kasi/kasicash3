# Independent Review Prompt: Phase 4 Round 1

You are a senior backend/accounting-systems engineer doing an independent review of KasiCash Phase 4: Core Reports.

Start with a receipt check: list every delivered Phase 4 file you received and flag any expected file that is missing.

Review the implementation for:

- Read-only-ness: no report path may insert, update, delete, save, or mutate ledger data; verify the read-only transaction boundary.
- Reversal netting: reports must include the original `REVERSED` ledger row plus the posted reversal row so balances net to zero.
- Tenant scoping: every report query must be scoped to one `business_id`; account statement must reject accounts outside the business.
- Money safety: all money must stay bigint minor-unit strings end-to-end; no floats or JavaScript `number` money math.
- Timezone determinism: period bounds must use explicit IANA timezone handling, not server locale.
- Query correctness for the three reports: cash position, income statement, and account statement with running balance.
- Tests: verify the unit tests and Testcontainers integration test cover report math, reversal netting, tenant isolation, and real LedgerService-posted transactions.
- Migration safety: any report indexes must be added in a new reversible migration and must not edit prior ledger migrations.
- Deferred scope: cached/materialized reports, more report types, auth/access control, and per-business timezone preferences should be logged as tech debt or roadmap items.

Hunt specifically for mutation-on-read paths, cross-tenant leaks, status filtering mistakes, float money, and report figures that cannot be traced back to ledger entries.

Rate the work from 1-10, list blockers and non-blocking improvements, and give a verdict: is Phase 4 complete pending a green CI run?
