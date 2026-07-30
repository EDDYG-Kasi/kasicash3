# KasiCash Engineering Constitution

This document is the governing rulebook for KasiCash. It states the non-negotiable
invariants every phase must uphold and the principles that decide design questions
when the code is silent. If code and this document disagree, one of them is a bug:
fix the code, or change this document deliberately with a dated entry in
`DECISIONS.md`.

## 0. What KasiCash Is

KasiCash is a WhatsApp-driven financial operating system for informal South African
traders. A trader interacts through natural-language messages; the system keeps
their books. The books are an immutable double-entry ledger. Everything else exists
to serve that ledger or read from it.

The ledger is a legal record. When in doubt, choose the option that makes the
record more trustworthy, more traceable, and harder to corrupt.

## 1. The Ledger Is The Single Legal Record

1. The only record of financial truth is the double-entry ledger: `transactions`
   and `entries`.
2. The ledger is append-only and immutable. Posted transactions and entries are
   never updated or deleted. Database triggers/constraints enforce this.
3. The only correction path is reversal: a new transaction with mirrored accounts
   and amounts, opposite sides, linked to the original. Reversals are immutable and
   cannot themselves be reversed.
4. Every transaction moves through `POSTING` -> `POSTED` -> optionally `REVERSED`.
   A transaction may only be committed once balanced and non-empty.
5. Double-entry is a database invariant: debits equal credits for every committed
   transaction.

## 2. Money

1. Money is stored and carried as integer minor units represented as strings.
   There are no floats on money paths.
2. Money is formatted into major units only at the outer presentation boundary.
3. Every amount is currency-aware. Amounts of different currencies are never mixed.
4. Rounding must be explicit, documented, and deterministic.

## 3. Multi-Tenancy And Isolation

1. Every read and write is scoped to exactly one `business_id`.
2. Tenant identity is derived from trusted server-side context, especially inbound
   `wa_phone` resolved to a business. Message text may never select or widen tenant
   scope.
3. Cross-tenant references are structurally prevented where possible with
   composite foreign keys and database constraints.

## 4. AI Boundaries

1. AI never writes the ledger. AI may propose; a human confirms; trusted code posts.
   The confirm step is mandatory and cannot be skipped or auto-approved.
2. AI never produces financial figures on the read side. It resolves intent and
   parameters only. Every number in a reply comes from deterministic aggregation
   over posted ledger entries.
3. AI output is untrusted. Structured output is validated against tenant scope,
   known accounts, sane ranges, and action allowlists before any database read or
   write occurs.
4. Replies never assert unverified financial facts. Ambiguous or out-of-scope input
   gets a clarification or honest refusal, not a guessed number.

## 5. Trust Boundaries And Input

1. All external input is untrusted: webhook payloads, message text, headers, and
   model output.
2. Webhook authenticity is verified cryptographically with HMAC over the exact raw
   bytes before business processing.
3. Prompt injection is assumed. Message content may not widen scope, cross tenants,
   induce a ledger write, exfiltrate data, or fabricate a figure.
4. Secrets and private financial content are never logged. Error logs are bounded
   and sanitized.

## 6. Reliability

1. No message is silently lost. Inbound messages are durably persisted before
   processing.
2. Processing is idempotent. The same inbound message must not create duplicate
   financial effects or duplicate replies.
3. Failures are recoverable without user re-entry. Transient failures retry with
   backoff; permanently failing messages are dead-lettered with raw payload
   preserved.
4. Non-ledger side effects, such as sending replies, are best-effort and must not
   corrupt or re-trigger the authoritative path.
5. Webhook acknowledgement is fast and not blocked by downstream processing.

## 7. Schema And Change Management

1. Schema is defined by ordered, reversible migrations. `synchronize` is never used
   against a real database.
2. Migrations are append-only. A new phase adds migrations; it does not edit shipped
   migrations. Every migration has a working `down()`.
3. Database-enforceable invariants are enforced in the database.

## 8. Testing And Acceptance

1. Behaviour is proven by tests, not asserted by prose.
2. Database-enforced invariants are proven against a real database, not only mocks.
3. Definition of done includes green CI: build, lint, unit tests, integration tests
   against real PostgreSQL, and migration run/revert of the full chain.
4. Independent review must be able to trace every claimed guarantee to code and
   tests.

## 9. Scope Discipline

1. Each phase does one thing well. Read paths do not write. Write paths go through
   the confirm flow.
2. Deferred work is logged explicitly in `TECH_DEBT.md` and `ROADMAP.md`.
3. Prefer correctness and containment over breadth.

## 10. Decision-Making When This Document Is Silent

Choose the option that:

1. keeps the ledger most trustworthy and traceable;
2. fails safe;
3. is easiest to prove with a test;
4. is simplest to reason about later.

Record non-obvious choices in `DECISIONS.md`.
