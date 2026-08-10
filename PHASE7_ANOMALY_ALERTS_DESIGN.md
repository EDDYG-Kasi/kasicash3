# Phase 7 Anomaly Detection And Proactive Alerts Design

Phase 7 adds deterministic anomaly detection and WhatsApp alert dispatch. It
does not use ML, does not let AI produce figures, and does not mutate ledger
data. Alerts are notification metadata, not financial records.

## Governing Rules

- Detection reads only ledger-derived data. It does not call ledger writers and
  does not mutate financial tables.
- Figures come from posted ledger history. Reversals net through the same
  `POSTED` plus `REVERSED` semantics used by Phase 4 reports and Phase 6
  analytics; `POSTING`, pending proposals, and unposted states are excluded.
- Detection reuses Phase 6 daily `income vs expenses` analytics for rolling
  revenue/expense baselines. A narrow read-only query is added only for
  active single-expense transaction candidates because Phase 6 exposes account
  breakdowns, not per-transaction expense candidates.
- Money remains bigint-compatible minor-unit strings. Threshold comparisons use
  `BigInt` multiplication and division only; no floats.
- Windows and buckets are local-date based in the requested IANA timezone and
  use Phase 4 `computeReportPeriod` for UTC ledger bounds.
- Alert delivery writes only `anomaly_alerts` notification metadata for
  idempotency/recovery. It never writes `transactions`, `entries`, or
  `accounts`.
- Alert recipient comes from trusted `businesses.wa_phone`, not message text.
- When an anomaly cannot be proven from enough baseline data, no alert is sent.

## Provisional Thresholds

These thresholds are deliberately conservative and provisional. Their
real-world validity depends on actual trader transaction volume and must be
validated/tuned against real seeded and production-like data.

| Rule | Baseline | Alert Condition | Fail-Safe Minimum |
|---|---|---|---|
| Large single expense | Prior 30 local days, non-zero expense days only | Active posted expense transaction is at least 3x average non-zero daily expense | At least 5 baseline expense days and the currency-specific absolute floor |
| Sales spike | Prior 14 local days, all days in denominator | Target-day sales are at least 2x rolling average | At least 7 active sales days, the currency-specific baseline floor, and the currency-specific delta floor |
| Sales drop | Prior 14 local days, all days in denominator | Target-day sales are at most 50% of rolling average | At least 7 active sales days and the currency-specific baseline floor |
| Activity gap | Prior 30 local days, excluding the current 3-day gap | No sales for the last 3 local days | At least 8 active sales days in the prior baseline window |

The ratio, lookback, and evidence-count constants are in `anomaly.rules.ts`.
Absolute money floors are loaded inside the service's read-only transaction
from the database-authoritative `supported_currencies` row for the requested
currency. Migration `1700000015000` seeds these provisional major-unit-equivalent
floors:

| Currency | Large expense | Sales baseline | Spike delta |
|---|---:|---:|---:|
| ZAR | 50,000 minor (ZAR 500.00) | 100,000 minor (ZAR 1,000.00) | 20,000 minor (ZAR 200.00) |
| USD | 50,000 minor (USD 500.00) | 100,000 minor (USD 1,000.00) | 20,000 minor (USD 200.00) |
| JPY | 500 minor (JPY 500) | 1,000 minor (JPY 1,000) | 200 minor (JPY 200) |
| BHD | 500,000 minor (BHD 500.000) | 1,000,000 minor (BHD 1,000.000) | 200,000 minor (BHD 200.000) |

Unsupported currencies fail at the database foreign-key boundary. These values
are not claims of real-world validity; they remain provisional and need tuning
against representative transaction history, ideally per business.

## Rule 1: Unusually Large Single Expense

Detection date is `asOfLocalDate` (defaults to the current local date in the
requested timezone). The service:

1. Uses Phase 6 daily income/expense series from `asOf - 30 days` through
   `asOf`.
2. Computes baseline total from prior non-zero expense days only.
3. Reads candidate expenses for `asOf` using a read-only query grouped by
   transaction id.
4. Considers only transactions with `t.status = 'POSTED'` and
   `t.reversal_of_transaction_id IS NULL`, so already reversed originals and
   reversal transactions do not trigger a fresh single-expense alert.
5. Emits an alert if:

```text
candidateExpense * baselineActiveExpenseDays >= baselineExpenseTotal * 3
AND candidateExpense >= 50000 minor units
AND baselineActiveExpenseDays >= 5
```

The alert includes the candidate expense amount and baseline average, both
formatted from bigint strings.

## Rule 2: Sudden Daily Sales Spike Or Drop

The service reuses Phase 6 day buckets and takes the previous 14 local days as
the rolling baseline. Revenue is account family `400` / `400.%` from posted
history.

Spike:

```text
targetSales * baselineDays >= baselineSalesTotal * 2
AND targetSales - baselineAverage >= 20000 minor units
```

Drop:

```text
targetSales * baselineDays * 2 <= baselineSalesTotal
```

Both require at least 7 non-zero baseline sales days and a baseline average of
at least 100000 minor units.

## Rule 3: Activity Gap

The service checks the last 3 local days ending on `asOfLocalDate`. If all three
days have zero sales and the trader had sales on at least 8 days in the prior
baseline window, it emits an activity-gap anomaly.

No money is invented for this alert. It reports only the proven gap dates and
baseline active-day count from the ledger-derived daily series.

## Alert Idempotency And Recovery

Each anomaly gets a deterministic key:

- `anomaly:v1:large-expense:{businessId}:{currency}:{transactionId}`
- `anomaly:v1:sales-spike:{businessId}:{currency}:{localDate}`
- `anomaly:v1:sales-drop:{businessId}:{currency}:{localDate}`
- `anomaly:v1:activity-gap:{businessId}:{currency}:{gapStart}:{gapEnd}`

`anomaly_alerts` has a unique `(business_id, anomaly_key)` constraint. Dispatch:

1. Detects anomalies.
2. Reads `businesses.wa_phone` for the trusted recipient.
3. Claims an alert row as `SENDING`.
4. Sends through `WhatsAppClient.sendText`.
5. Marks the alert `SENT` or `FAILED`.

Existing `SENT` and `DELIVERY_UNCERTAIN` rows are never sent again. A `FAILED`
row, or a stale `SENDING` row whose external dispatch has not started, may be
claimed again. Immediately before calling the provider, dispatch atomically sets
`dispatch_started_at`; from that point onward any failure is terminally marked
`DELIVERY_UNCERTAIN` and automatic resend is forbidden.

If both the `SENT` update and immediate uncertainty update fail after provider
acceptance, `AnomalyReconciliationService` finds started `SENDING` rows older
than 15 minutes and terminalizes them as `DELIVERY_UNCERTAIN` without calling
the provider. Provider message receipts remain necessary to resolve whether the
external send actually arrived.

## Deferred

- ML-assisted candidate detection.
- Per-business tunable thresholds.
- Alert preferences and opt-out.
- Scheduled detection/dispatch workers and backoff policy.
- Provider-level outbound idempotency.
- Provider delivery-receipt reconciliation and operator-controlled retry.
