# Architecture Decision Records

## ADR 11: Phase 4 reports are read-only ledger aggregations

* **Date**: 2026-07-29
* **Context**: Core reports must summarize cash, income/expense, and account history without weakening the immutable ledger. The ledger is the single legal record; report figures must be traceable to posted entries and must not drift from cached/materialized state.
* **Decision**: Phase 4 reports are pure read-only aggregations over `accounts`, `entries`, and `transactions`. `ReportsService` runs every report inside a database transaction followed by `SET TRANSACTION READ ONLY`, then uses SELECT-only SQL through a `QueryRunner`. Reports include legal posted-history rows with status `POSTED` or `REVERSED`, and exclude transient/unconfirmed states such as `POSTING` or any future `PROPOSED` state. This is required because a reversal leaves the original row as `REVERSED` and creates a posted reversing transaction; including both makes balances net to zero.
* **Money**: All amounts remain integer minor-unit strings. Formatting uses `BigInt` arithmetic only; no floats.
* **Tenant scope**: Every report query filters by one `business_id`. Account statements first verify the requested account belongs to that business.
* **Timezone**: Callers pass an IANA timezone, defaulting to `Africa/Johannesburg` until businesses store timezone preferences. Local date ranges are converted to UTC bounds by the service.
* **Indexes**: Migration `1700000006000-ReportReadIndexes` adds read indexes only. No prior ledger migration or invariant is modified.
* **Consequences**: Reports are deterministic and traceable, but Phase 4 does not support cached dashboards, auth-bound access control, custom report types, or persisted per-business timezone settings. Those are deferred.

## ADR 12: Phase 5 conversational queries resolve intent, never figures

* **Date**: 2026-07-29
* **Context**: Traders need to ask financial questions over WhatsApp, but free-text input is untrusted and must not bypass the immutable ledger or tenant boundaries. AI may help resolve intent, but it must not compute or invent financial facts.
* **Decision**: Phase 5 adds a `ConversationalQueryModule` inside the existing durable ingestion path. Query-shaped inbound text is routed before Phase 3 parsing, resolved behind a mockable `CONVERSATIONAL_QUERY_RESOLVER` provider, validated against a per-business account allowlist, then answered only through Phase 4 `ReportsService` methods.
* **Read-only guarantee**: The conversational query service imports no ledger writer service and calls no transaction creation APIs. It reads only the current business's accounts for validation, then calls read-only report methods.
* **AI boundary**: Resolver output is treated as a proposal of `kind`, period, account hint, currency, and limit. The resolver may not provide tenant ids, account ids for another business, SQL, mutations, or final numbers. Replies render amounts only from report DTOs.
* **Tenant scope**: `businessId` comes only from onboarding via `wa_from`. Message content cannot choose a tenant.
* **Safety**: Prompt-injection-shaped query text is contained as out of scope and never falls through to Phase 3 transaction posting.
* **Consequences**: The first implementation is deliberately narrow: cash, sales/expenses over a period, expense/stock spend, and recent account transactions. Multi-turn context, richer natural language, product-level analytics, and live model providers are deferred.
