# Roadmap

1. Phase 1: Data model and immutable ledger core — complete.
2. Phase 2: WhatsApp ingestion and onboarding — complete. TD-3 live Cloud API send path is hardened and locally exercised with mock HTTP coverage; TD-5 delivery-status persistence remains deferred.
3. Phase 3: Deterministic transaction parsing with explicit confirmation — implemented locally, pending green CI.
4. Phase 4: Core reports — complete, pending green CI.
5. Phase 5: Conversational queries — implemented locally, pending green CI.
6. Phase 6: Visual analytics — implemented locally, pending green CI.
7. Phase 7: Anomaly detection and proactive alerts — implemented locally, pending green CI.
8. Phase 8: Web dashboard - implemented locally, pending green CI.
9. Phase 9: Security and auth - implemented locally, pending green CI.
10. Phase 10: Observability and hardening - implemented locally, pending green CI.
11. Independent full-system review rounds 1-3 remediation - implemented locally, pending green real-PostgreSQL CI and immutable revision evidence.

## Phase 4 Deferred

- Materialized or cached reports.
- More report types and richer analytics.
- Per-business timezone/preferences.
- Auth/access control for production report APIs. Raw report routes are disabled by default until this exists.

## Phase 5 Deferred

- Multi-turn conversational context and follow-up questions.
- Richer natural language date/account parsing.
- Live AI provider integration beyond the deterministic resolver abstraction.
- Product/category-level analytics beyond the seed chart accounts.
- Cached query answers or materialized conversational analytics.
- Free-form analytics outside the Phase 4 report allowlist.

## Phase 6 Deferred

- Materialized analytics aggregates for large ledgers; any future projection must be deterministically rebuildable from ledger entries.
- Product/category dimensions beyond chart-of-accounts families.
- More chart types beyond cash balance, income vs expenses, and spend breakdown.
- Front-end or dashboard chart rendering.
- Auth-bound analytics HTTP routes with server-side tenant context.

## Phase 7 Deferred

- ML-assisted anomaly candidate detection; any model may flag candidates only, while facts/figures must still come from ledger-derived code.
- Per-business tunable thresholds validated against real transaction volume.
- Alert preferences, quiet hours, and opt-out.
- Scheduled alert worker and retry/backoff policy.
- Provider-level outbound message idempotency.
- Provider delivery receipts and audited resolution of `DELIVERY_UNCERTAIN` sends.

## Phase 8 Deferred

- RBAC and multi-user business membership beyond the Phase 9 one-principal/one-business model.
- Any dashboard write actions; future writes must still use the existing confirm-then-post flow.
- Real-time dashboard updates and push refresh.
- Richer responsive/mobile polish.
- I18n/localized dashboard chrome beyond existing currency-aware DTO strings.
- A richer charting library once tests enforce no client-side money aggregation or float money.

## Phase 9 Deferred

- MFA and account recovery flows.
- RBAC roles, multi-user business membership, and least-privilege permissions.
- Security audit logging and suspicious-login monitoring.
- Centralized key management and session-secret rotation operations.
- External rate-limit storage/operations only if Postgres contention warrants moving the shared counters to Redis.
- Formal penetration testing before production exposure.

## Phase 10 Deferred

- Distributed tracing backend and OpenTelemetry export.
- Hosted metrics dashboards, alert rules, and log aggregation.
- Formal SLOs, error budgets, and incident response drills.
- Load testing and capacity planning against production-like transaction volume.
- Multi-instance metric aggregation and distributed recovery-worker coordination.

## WhatsApp Outbound Deferred

- Persist outbound provider `wamid` values and delivery attempts in a dedicated
  non-financial table before storing delivery-status callbacks.
- Reconcile `sent`/`delivered`/`read`/`failed` callbacks against stored outbound
  attempts without retrying best-effort ingestion replies.
- Attach manual sandbox Cloud API send evidence to the release record after an
  operator verifies the real provider outside CI.
