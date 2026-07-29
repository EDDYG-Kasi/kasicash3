# Independent Review Prompt: Phase 5 Round 1

You are a senior backend/accounting-systems engineer doing an independent review of KasiCash Phase 5: Conversational Queries.

Start with a receipt check: list every delivered Phase 5 file you received and flag any expected file that is missing.

Review the implementation for:

- Read-only-ness: conversational query handling must not insert, update, delete, save, or mutate ledger data, and must not call `LedgerService.postTransaction` or reversal methods.
- Report-derived figures: verify every amount in a WhatsApp query reply originates from Phase 4 `ReportsService` outputs, not from the resolver or message text.
- Resolver boundary: the AI/provider abstraction may propose only structured intent and parameters; it must not provide final numbers, tenant ids, SQL, or write instructions.
- Parameter validation and allowlisting: account hints, currency, periods, and limits must be validated before any report read; unknown accounts, absurd date ranges, and oversized limits must fail safely.
- Tenant scoping: `businessId` must derive from the inbound `wa_from` onboarding result, never from message content or resolver output.
- Money safety: all money must remain bigint minor-unit strings end-to-end, with formatting only at the reply boundary; hunt for float money math.
- Timezone handling: relative periods such as "this week" and "last month" must resolve in the business timezone assumption, currently `Africa/Johannesburg`.
- Ingestion guarantees: verify no regression to inbound idempotency, best-effort replies, processing leases, recovery retry behavior, or atomic claim.
- Integration correctness: run/check the Testcontainers query test against real PostgreSQL, including cash, income, spend, recent transactions, tenant isolation, and reversal netting.
- Prompt-injection resistance: hunt for scope widening, cross-tenant reads, induced writes, fabricated figures, mutation-on-read, and any path where query-shaped text falls through into Phase 3 posting.
- CI behavior: resolver must be stubbed/deterministic in CI with no live model calls.

Rate the work from 1-10, list blockers and non-blocking improvements, and give a verdict: is Phase 5 complete pending a green CI run?
