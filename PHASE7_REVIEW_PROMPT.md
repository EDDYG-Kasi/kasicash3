# Independent Review Prompt: Phase 7 Round 1

You are a senior backend/accounting-systems engineer performing an independent
review of KasiCash Phase 7: Anomaly Detection & Proactive Alerts.

Start with a receipt check: confirm which delivered files are present for Phase
7, including design, anomaly module/service/DTOs/rules/entity, migration, unit
tests, Testcontainers integration test, ADR/docs updates, and this review
prompt.

Review against the KasiCash engineering constitution:

- Detection must be read-only over ledger-derived posted history. Hunt for
  mutation-on-detect, calls to ledger writers, repository writes, or SQL
  mutation verbs on detection paths.
- Alert dispatch may write notification metadata only. Verify it cannot mutate
  `transactions`, `entries`, `accounts`, reports, or analytics financial data.
- Every anomaly and every alert figure must trace to posted ledger entries with
  reversals netted and non-posted/proposed rows excluded.
- Verify threshold determinism and explainability: no black-box scoring, no
  model-produced figures, and no untraceable financial claims.
- Verify provisional threshold caveat is documented and logged as technical
  debt for real-data tuning.
- Verify alert idempotency: same anomaly key for the same business is alerted
  once; repeated dispatch skips existing SENT/current rows and only retries
  FAILED/stale SENDING rows.
- Verify tenant scoping: all detection queries and alert rows use one trusted
  `business_id`, and recipient comes from `businesses.wa_phone`, never message
  content.
- Verify bigint money: no floats or Number arithmetic for money; comparisons
  use bigint minor-unit strings and formatting only at the presentation boundary.
- Verify fail-safe behavior: insufficient baselines or missing recipient should
  result in no alert, not a fabricated warning.
- Check the Testcontainers integration test's anomalies and figures against
  real Postgres, including realistic posted history, a real `LedgerService`
  reversal, other-tenant noise, pending proposal noise, and no duplicate sends.
- Check the new migration is append-only, reversible, and stores only
  non-financial alert metadata.
- Check CI coverage: new tests should run under the existing GitHub
  Actions/Postgres/Testcontainers pipeline, with any model use absent or stubbed.

Hunt specifically for mutation-on-detect, fabricated figures, duplicate alerts,
cross-tenant leaks, float money, alert spam, and drift from Phase 4/Phase 6
ledger-derived math.

Rate correctness, constitution compliance, threshold clarity, test strength,
and maintainability. Give a verdict on completeness pending green CI, and list
any blocking fixes before Phase 7 can be accepted.
