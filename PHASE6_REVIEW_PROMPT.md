# Independent Review Prompt: Phase 6 Round 1

You are a senior backend/accounting-systems engineer performing an independent
review of KasiCash Phase 6: Visual Analytics.

Start with a receipt check: confirm which delivered files are present for Phase
6, including design, analytics module/service/DTOs/math, migration, unit tests,
Testcontainers integration test, ADR/docs updates, and this review prompt.

Review against the KasiCash engineering constitution:

- Analytics must be strictly read-only. Hunt for mutation-on-read, injected
  writes, repository `save/update/delete`, or any SQL mutation verb on analytics
  read paths.
- Every figure must trace to posted ledger entries. Verify queries read
  `accounts`, `entries`, and `transactions`; include `POSTED` and `REVERSED`;
  exclude `POSTING`, pending proposals, and unposted states.
- Verify reversal netting: a `REVERSED` original plus its posted reversal should
  net correctly per bucket and in spend breakdowns.
- Verify bigint-money integrity: no floats, no Number arithmetic for money,
  minor units stay strings until DTO presentation formatting.
- Verify tenant scoping: all analytics methods accept/use one trusted
  `businessId` parameter and never derive tenant from message content or return
  cross-tenant data.
- Verify timezone correctness: day/week/month buckets are generated in the
  requested IANA timezone, then compared to UTC ledger bounds consistently with
  Phase 4.
- Verify no pre-aggregation drift: Phase 6 should not create a cache or
  materialized financial table. If any projection exists, it must be
  deterministically rebuildable from the ledger and documented.
- Check the Testcontainers integration test's seeded values against real
  Postgres, including the `LedgerService` reversal, tenant B exclusion, pending
  proposal exclusion, and Africa/Johannesburg boundary bucket.
- Check the new migration is append-only, reversible, and read-index-only.
- Check CI coverage: new tests should run under the existing GitHub
  Actions/Postgres/Testcontainers pipeline.

Rate the work for correctness, constitution compliance, test strength, and
maintainability. Give a verdict on completeness pending green CI, and list any
blocking fixes before Phase 6 can be accepted.
