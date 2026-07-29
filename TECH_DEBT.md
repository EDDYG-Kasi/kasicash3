# Technical Debt Register

| ID | Date | Reason | Risk | Impact | Future Fix | Priority | Estimated Effort |
|---|---|---|---|---|---|---|---|
| TD-7 | 2026-07-29 | Business timezone is not stored on `businesses`; Phase 4 callers pass an IANA timezone and default to `Africa/Johannesburg`. | Low | Reports are deterministic, but callers must provide the correct timezone for non-default businesses. | Add a timezone/preference column or profile table and use it by default. | Med | 0.5d |
| TD-8 | 2026-07-29 | Phase 4 intentionally avoids report caches/materialized views. | Low | Large ledgers may eventually need faster dashboard reads. Current reports stay correct and traceable. | Add explicitly invalidated/materialized reporting views once usage patterns justify it. | Med | 1-2d |
| TD-9 | 2026-07-29 | Report controller routes are unauthenticated for now, matching Phase 4 scope. | High | Routes must not be exposed in production without auth/tenant authorization. | Add auth and access-control policy in Phase 9. | High | 1-2d |
| TD-10 | 2026-07-29 | Phase 4 includes only cash position, income statement, and account statement. | Low | No richer analytics yet. | Add balance sheet, cash-flow, trends, tax/VAT reports, and visual dashboards in later phases. | Med | 2d+ |
