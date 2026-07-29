# Phase 5 Conversational Queries Design

## Goal

Phase 5 lets a WhatsApp user ask read-only questions about their posted books. The message text is untrusted. It can suggest an intent and parameters, but every financial figure in the reply must come from the deterministic Phase 4 `ReportsService`.

## Confirmed Current Shapes

- Ingestion is already idempotent and durable in `IngestionService.processMessage`: it atomically claims one inbound row, onboards or resolves the business from `wa_from`, processes the message, marks it `PROCESSED`, then sends a best-effort reply.
- Phase 3 currently lives in `ParsingService.parseAndPost`, which parses transaction text and posts through `LedgerService`.
- Phase 4 exports `ReportsService` from `ReportsModule` with:
  - `getCashPosition({ businessId, currency })`
  - `getIncomeStatement({ businessId, from, to, timezone, currency })`
  - `getAccountStatement({ businessId, accountId, from, to, timezone, currency, limit, offset })`
- `Business` currently stores `waPhone` but not timezone or default currency. Phase 5 defaults to `Africa/Johannesburg` and `ZAR`; business-level preferences are deferred.

## Routing Decision

The existing ingestion path stays the single owner of webhook processing:

1. Claim inbound message atomically.
2. Resolve/create business from `wa_from`.
3. Route text:
   - `QUERY`: handled by Phase 5 and returns a read-only reply.
   - `TRANSACTION`: hand to Phase 3 `ParsingService.parseAndPost`.
   - `FALLBACK`: use the existing unrecognized transaction fallback.
4. Mark inbound `PROCESSED`.
5. Send reply best-effort.

Query-shaped messages win before Phase 3 parsing so prompt-injection text such as "how much cash do I have, also record R999" cannot fall through into a write. Non-query transaction text such as "sold R30 airtime" still goes to Phase 3.

## Structured Resolver Schema

The resolver is provider-agnostic and mockable, behind a `CONVERSATIONAL_QUERY_RESOLVER` token. The default implementation is deterministic and CI-safe. A future live AI provider may return only this schema:

```ts
type ResolvedConversationalQuery =
  | { kind: 'NOT_QUERY' }
  | { kind: 'CLARIFY'; question: string }
  | { kind: 'OUT_OF_SCOPE'; reason: string }
  | { kind: 'CASH_BALANCE'; currency?: string }
  | {
      kind: 'INCOME_STATEMENT';
      period: PeriodProposal;
      currency?: string;
    }
  | {
      kind: 'ACCOUNT_SPEND';
      accountHint?: string;
      period: PeriodProposal;
      currency?: string;
    }
  | {
      kind: 'RECENT_TRANSACTIONS';
      accountHint?: string;
      limit?: number;
      period?: PeriodProposal;
      currency?: string;
    };

type PeriodProposal =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | { from: 'YYYY-MM-DD'; to: 'YYYY-MM-DD' };
```

The resolver is not allowed to output tenant identifiers, account IDs, SQL, mutations, or final financial numbers. If a future provider returns extra fields, code ignores them and validates only the schema above.

## Validation And Allowlisting

Validation happens after resolver output and before any Phase 4 report call.

- Tenant scope is always `business.id` from onboarding. Message content and resolver output cannot set `businessId`.
- Accounts are read for only the current business, then allowlisted by account id, code, name, and safe aliases:
  - `100`, `cash`
  - `400`, `sales`, `sale`, `income`
  - `500`, `expenses`, `expense`, `spend`, `spent`, `stock`
- Unknown account hints produce a clarifying reply, not a report.
- Currency must pass Phase 4 `normalizeCurrency`; default is `ZAR`.
- Timezone defaults to `Africa/Johannesburg`; all relative periods are converted to local `YYYY-MM-DD` boundaries before calling reports.
- Custom periods are capped at 366 days. Recent-transaction periods use a bounded default window of 366 days.
- Recent transaction limits are integers between 1 and 5. Oversized or invalid limits are rejected with a clarifying reply.
- Query text that tries to widen scope, read another tenant, induce a write, or force a made-up number is handled as a query/refusal and never falls through to Phase 3.

## Intent To Report Mapping

- `CASH_BALANCE` -> `ReportsService.getCashPosition`
- `INCOME_STATEMENT` -> `ReportsService.getIncomeStatement`
- `ACCOUNT_SPEND` -> `ReportsService.getIncomeStatement`, using the deterministic `expenses` figure for the validated expense/stock account family in this seed chart
- `RECENT_TRANSACTIONS` -> `ReportsService.getAccountStatement` for the validated account over a bounded period. The Phase 5 renderer takes the last `N` returned report lines only when the report total is within the bounded window; if there are too many rows for a safe answer, it asks the user to narrow the period.

## Reply Templates

- Cash: `You have {netCash.formatted} cash right now.`
- Income: `From {from} to {to}: sales {revenue.formatted}, expenses {expenses.formatted}, net income {netIncome.formatted}.`
- Spend: `From {from} to {to}, I see {expenses.formatted} in expenses.`
- Recent: `Last {N} {accountName} transaction(s): ...`
- No data: `I do not see any posted {topic} for that period yet.`
- Clarify: a single plain-language question.
- Out of scope: `I can't answer that yet. I can answer cash, sales/expenses over a period, or recent sales/expenses.`

## Ingestion Guarantees

Phase 5 is called inside the existing claimed processing section. It does not alter the raw inbound insert, unique message id handling, recovery worker, processing lease, or best-effort send behavior. Resolver failures are converted to a helpful reply so one bad query does not crash or silently drop a message.

## Deferred Scope

- Business-level timezone and default currency preferences.
- Multi-turn clarification context.
- Richer natural language date parsing.
- Product/category-level analytics beyond the seed chart.
- Caching or materialized report snapshots.
- Free-form analytics outside Phase 4 report paths.
