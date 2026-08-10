# Phase 6 Visual Analytics Design

Phase 6 exposes chart-ready data series only. It does not render images, does
not add a front-end, and does not write or cache financial figures.

## Governing Rules

- Analytics are strictly read-only. `AnalyticsService` uses a TypeORM
  `QueryRunner`, starts a transaction, executes `SET TRANSACTION READ ONLY`,
  and then runs SELECT-only queries.
- Figures are derived live from `accounts`, `entries`, and `transactions`.
  There is no Phase 6 pre-aggregation table, materialized view, or cache.
- Analytics include transaction rows with `t.status IN ('POSTED', 'REVERSED')`
  and exclude `POSTING`, proposals, and any unposted future status.
- Reversals net through ordinary double-entry signs: the original transaction is
  retained as `REVERSED`, and the posted reversal transaction has inverted
  entries. Including both rows nets the economic effect to zero.
- Every query filters by one trusted `business_id` parameter and one currency.
  Message text never selects a tenant.
- Money remains integer minor units. SQL sums numeric integer expressions and
  TypeScript returns bigint-compatible decimal strings; formatting happens only
  through the existing Phase 4 `toMoneyDto` presentation helper.
- Local date ranges are converted by the existing Phase 4
  `computeReportPeriod(from, to, timezone)` helper. Buckets are generated in the
  requested IANA timezone and converted back to UTC bounds for ledger filtering.

## Shared Signed Entry Formula

Phase 6 mirrors the Phase 4 signed-entry behavior:

```sql
CASE
  WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'DEBIT' THEN e.amount_minor
  WHEN a.type IN ('ASSET', 'EXPENSE') AND e.type = 'CREDIT' THEN -e.amount_minor
  WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'CREDIT' THEN e.amount_minor
  WHEN a.type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND e.type = 'DEBIT' THEN -e.amount_minor
  ELSE 0
END
```

This preserves the same sign convention P4 reports rely on: assets and
expenses are debit-positive; liabilities, equity, and revenue are
credit-positive.

## Bucket Generation

Supported granularities are `day`, `week`, and `month`.

Each range uses inclusive local dates from the request and an exclusive UTC end:

```ts
const period = computeReportPeriod(from, to, timezone);
```

The SQL bucket CTE is:

```sql
SELECT
  gs AS bucket_start_local,
  (gs AT TIME ZONE $timezone) AS bucket_start_utc,
  ((gs + $step::interval) AT TIME ZONE $timezone) AS bucket_end_utc_exclusive
FROM generate_series(
  date_trunc($granularity, timezone($timezone, $startUtc::timestamptz)),
  date_trunc($granularity, timezone($timezone, $endInclusiveUtc::timestamptz)),
  $step::interval
) AS gs
```

`$step` is `1 day`, `1 week`, or `1 month`. The generated local bucket start is
the chart label source; UTC bucket bounds are used for ledger comparisons.

## Series 1: Cash Balance Over Time

Cash accounts are the same account-code family used by P4 cash reports:

```sql
a.code = '100' OR a.code LIKE '100.%'
```

For each bucket:

1. Select cash ledger entries for the business and currency with status
   `POSTED` or `REVERSED`.
2. Compute `opening_minor` as the signed sum before the first bucket start.
3. Compute `delta_minor` per bucket for entries whose `occurred_at` is within
   `[bucket_start_utc, bucket_end_utc_exclusive)`.
4. Compute running balance with:

```sql
opening_minor
+ SUM(delta_minor) OVER (ORDER BY bucket_start_utc)
```

DTO point shape:

```ts
{
  label: string;
  bucketStartLocal: string;
  bucketStartUtc: string;
  bucketEndUtcExclusive: string;
  cashDelta: MoneyDto;
  cashBalance: MoneyDto;
}
```

## Series 2: Income Vs Expenses Per Period

Revenue uses account code `400` / `400.%`; expenses use `500` / `500.%`.

For each bucket:

```sql
SUM(CASE WHEN a.code = '400' OR a.code LIKE '400.%' THEN signed_minor ELSE 0 END)
SUM(CASE WHEN a.code = '500' OR a.code LIKE '500.%' THEN signed_minor ELSE 0 END)
```

`net_income_minor = revenue_minor - expenses_minor` using bigint-string math in
TypeScript.

DTO point shape:

```ts
{
  label: string;
  bucketStartLocal: string;
  bucketStartUtc: string;
  bucketEndUtcExclusive: string;
  revenue: MoneyDto;
  expenses: MoneyDto;
  netIncome: MoneyDto;
}
```

## Series 3: Spend By Account Breakdown

The period breakdown groups expense-family entries only:

```sql
a.code = '500' OR a.code LIKE '500.%'
```

Rows are grouped by account id/code/name, netted with the same signed-entry
formula, and zero-net rows are omitted. `totalExpenses` is summed in TypeScript
from the returned bigint strings.

DTO row shape:

```ts
{
  accountId: string;
  accountCode: string;
  accountName: string;
  expense: MoneyDto;
}
```

## Pre-Aggregation

Phase 6 introduces no pre-aggregation. Future materialized analytics may be
added only as deterministic, rebuildable projections from the immutable ledger,
with explicit invalidation/rebuild rules and tests proving no drift.

## Deferred

- Materialized aggregates for large ledgers.
- Product/category dimensions beyond the existing chart-of-accounts families.
- More chart types.
- Front-end/dashboard rendering.
- Auth-bound HTTP analytics routes.
