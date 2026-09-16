# KasiCash Phase 8 Trader Dashboard Redesign - Independent Review Prompt

You are a senior product designer, front-end engineer, and accounting-systems reviewer. Perform a delta review of the KasiCash Phase 8 dashboard redesign.

## Receipt Check

Confirm the archive/repo includes these changed or relevant files:

- `src/dashboard/dashboard.frontend.ts`
- `src/dashboard/dashboard.frontend.spec.ts`
- `src/dashboard/dashboard.service.ts`
- `test/dashboard.e2e-spec.ts`
- `PHASE8_DASHBOARD_DESIGN.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TECH_DEBT.md`
- `DASHBOARD_TRADER_REDESIGN_REVIEW_PROMPT.md`

## Context

KasiCash is a NestJS + PostgreSQL + TypeORM modular monolith for informal South African traders. The dashboard is a read-only browser view over existing services:

- Phase 4 reports: cash position, income statement, account statement.
- Phase 6 analytics: cash trend, income-vs-expenses, spend breakdown.
- Phase 7 anomalies/alerts.

The redesign is presentation-only. It must not add a ledger write path, mutate financial data, introduce client-selected tenant scope, or fabricate any figure.

## Review Goals

1. Verify the UI no longer reads like a developer debug view:
   - no visible `P4`, `P6`, `P7`;
   - no visible `Read-only trader dashboard`;
   - no visible `Bucket`, `Delta`, `Running`, or `statement lines`;
   - plain trader language is used for filters, KPIs, charts, tables, and alerts.

2. Verify the supplied KasiCash brand sheet is applied:
   - logo/wordmark treatment uses a `Kc` lockup with the `c` in vivid green;
   - primary palette is vivid green `#00C853`, black `#0E0E0E`, and warm ivory `#F7F6F1`;
   - typography uses a Poppins-first stack with safe fallbacks;
   - the tagline `Simple to run. Easy to grow.` appears on login/dashboard chrome;
   - brand colors do not erase financial semantics: expenses remain clearly outflow/red and alerts remain warning/amber.

3. Verify trust and clarity:
   - the first answer is a plain-language headline such as "You sold R 2 030.00 this period and kept R 1 610.00 after costs.";
   - Sales minus Costs equals Profit is visibly reconciled;
   - Current cash is explained as different from period profit when opening cash, stock, owner drawings, loans, or other movements exist;
   - the UI never implies a lender, insurer, government, or guarantee decision.

4. Verify South African money display:
   - visible money is displayed as `R 2 030.00` with a space thousands separator;
   - negative money is displayed as `-R 420.00`;
   - raw `ZAR 2030.00` style strings do not leak into the dashboard UI;
   - the browser script does not use `amountMinor`, `parseFloat`, `Number()`, `.toFixed`, or client-side money aggregation.

5. Verify read-only/data provenance:
   - dashboard endpoints still call existing P4/P6/P7 read services;
   - no ledger write path or mutation route was added;
   - displayed figures come from the existing DTOs, not fabricated front-end values;
   - server-side tenant scoping remains authenticated and non-overridable by query parameters.

6. Verify mobile-first product quality:
   - single-column phone layout has one clear starting point;
   - cards do not cut off labels or amounts;
   - there is no body-level horizontal overflow at a phone viewport;
   - charts show readable value labels or collapse to compact single-reading states for sparse data;
   - loading, empty, and error states are explicit and honest.

7. Verify accessibility basics:
   - focusable controls have visible focus states;
   - charts have screen-reader labels/list structure;
   - contrast appears WCAG-AA reasonable for text;
   - table headings use plain language and semantic table markup.

## Tests To Run

Run, at minimum:

```bash
npm test -- --runInBand dashboard.frontend.spec.ts dashboard.service.spec.ts
npm run build
npm run lint
```

If PostgreSQL/Testcontainers is available, also run:

```bash
npm run test:integration -- --runInBand test/dashboard.e2e-spec.ts
```

For browser verification, log in to `/auth/login`, open `/dashboard`, and inspect both a phone-width viewport and a desktop-width viewport.

## Hunt For Regressions

- Any new dashboard write path or ledger mutation.
- Any client-side money math, float parsing, or raw minor-unit access.
- Any raw `ZAR ...` values visible in the dashboard UI.
- Any cross-tenant selector or query parameter that overrides the authenticated principal.
- Any chart showing bars without readable values.
- Any sparse-data view filled with meaningless empty rows.
- Any UI text that sounds like an accounting/debug tool rather than a trader product.

## Verdict Format

Return:

1. Receipt check.
2. Findings by severity with exact file/line references.
3. Product/design verdict.
4. Read-only/accounting-invariant verdict.
5. Test results and any blocked tests.
6. Rating out of 10.
7. Final verdict: accept, accept with nits, or reject pending fixes.
