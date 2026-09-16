# Phase 8 Web Dashboard Design

Phase 8 adds a polished read-only web dashboard and backend-for-frontend (BFF)
for one authenticated business. It is a view over existing read services only:
Phase 4 reports, Phase 6 analytics, and Phase 7 anomaly detection/alert
metadata. It introduces no ledger write path and no dashboard shortcut around
the WhatsApp confirm-then-post flow.

The original Phase 8 plan allowed a temporary server-side tenant stub until
Phase 9. The current codebase has already completed Phase 9, so the dashboard
uses the stricter boundary: `AuthGuard` plus `DashboardTenantGuard`, deriving
business, currency, and timezone from the authenticated principal. No
client-supplied tenant selector exists.

## Governing Rules

- Dashboard endpoints are read-only. They do not call `LedgerService`, do not
  write `transactions`, `entries`, `accounts`, proposals, reports, analytics,
  or financial cache tables, and expose no mutation routes.
- Financial figures come from existing read services:
  - Phase 4 `ReportsService` for cash position, income statement, and account
    statement.
  - Phase 6 `AnalyticsService` for cash-balance, income-vs-expenses, and
    spend-by-account chart data.
  - Phase 7 `AnomalyService.detectAnomalies()` for current anomaly facts.
- Alert status metadata is read from `anomaly_alerts` with `SET TRANSACTION READ
ONLY`; this is notification metadata, not a financial record.
- The dashboard never accepts `businessId`, `currency`, or `timezone` from the
  client. Those values come from the authenticated principal's trusted
  server-side context.
- The front end displays `MoneyDto.formatted` strings returned by read services.
  It never aggregates money, parses money as `Number`, uses floats, or computes
  financial totals.

## Endpoint To Read-Service Mapping

All endpoints are under `/dashboard` and require `AuthGuard` plus
`DashboardTenantGuard`.

| Endpoint                                           | Client Parameters                                                            | Existing Service Used                                             | Output                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `GET /auth/login`                                  | none                                                                         | none                                                              | Browser login page for existing session auth |
| `POST /auth/login`                                 | `email`, `password`                                                          | `AuthService.login`                                               | HttpOnly session cookie plus JSON response   |
| `GET /dashboard`                                   | none                                                                         | none                                                              | HTML shell                                   |
| `GET /dashboard/assets/app.js`                     | none                                                                         | none                                                              | Browser script                               |
| `GET /dashboard/api/overview`                      | `from`, `to`, `granularity`, `accountId`, `limit`, `offset`, `asOfLocalDate` | P4 + P6 + P7                                                      | Combined dashboard DTO                       |
| `GET /dashboard/api/cash-position`                 | none                                                                         | `ReportsService.getCashPosition`                                  | `CashPositionReportDto`                      |
| `GET /dashboard/api/income-statement`              | `from`, `to`                                                                 | `ReportsService.getIncomeStatement`                               | `IncomeStatementReportDto`                   |
| `GET /dashboard/api/accounts/:accountId/statement` | `from`, `to`, `limit`, `offset`                                              | `ReportsService.getAccountStatement`                              | `AccountStatementReportDto`                  |
| `GET /dashboard/api/analytics/cash-balance`        | `from`, `to`, `granularity`                                                  | `AnalyticsService.getCashBalanceSeries`                           | `CashBalanceSeriesDto`                       |
| `GET /dashboard/api/analytics/income-expenses`     | `from`, `to`, `granularity`                                                  | `AnalyticsService.getIncomeVsExpensesSeries`                      | `IncomeExpenseSeriesDto`                     |
| `GET /dashboard/api/analytics/spend-by-account`    | `from`, `to`                                                                 | `AnalyticsService.getSpendByAccountBreakdown`                     | `SpendByAccountBreakdownDto`                 |
| `GET /dashboard/api/anomalies`                     | `asOfLocalDate`                                                              | `AnomalyService.detectAnomalies` + read-only alert metadata query | Current anomalies and alert statuses         |

`from` and `to` are local dates interpreted in the authenticated business
timezone. If omitted, the BFF defaults to the last 30 local days ending today in
that timezone. `granularity` defaults to `day`. The service bounds periods,
limits, and offsets before it calls read services.

## Tenant Guard And Phase 9 Handoff

`DashboardTenantContextService` reads the already-authenticated principal and
returns:

```text
businessId = principal.businessId
currency   = principal.defaultCurrency
timezone   = principal.timezone
boundary   = PHASE_9_AUTHENTICATED_PRINCIPAL
```

`DashboardTenantGuard` attaches this context to each dashboard request. Query
parameters or JSON fields named `businessId`, `currency`, or `timezone` are
ignored. This is the Phase 9 handoff state, not the original Phase 8 stub; it
is production-shaped server-side authorization for one-principal/one-business
accounts.

## Overview DTO

`DashboardOverviewDto` reuses existing DTOs and adds only dashboard metadata:

```ts
{
  generatedAt: string;
  tenant: {
    businessId: string;
    currency: string;
    timezone: string;
    authBoundary: 'PHASE_9_AUTHENTICATED_PRINCIPAL';
    productionReady: true;
  };
  period: {
    from: string;
    to: string;
    granularity: 'day' | 'week' | 'month';
    accountId?: string;
    limit: number;
    offset: number;
    asOfLocalDate: string;
  };
  kpis: {
    transactionCount: number;
    transactionCountLabel: string;
  };
  cashPosition: CashPositionReportDto;
  incomeStatement: IncomeStatementReportDto;
  accountStatement: AccountStatementReportDto | null;
  analytics: {
    cashBalance: CashBalanceSeriesDto;
    incomeVsExpenses: IncomeExpenseSeriesDto;
    spendByAccount: SpendByAccountBreakdownDto;
    chartScales: {
      cashBalance: DashboardChartPointDto[];
      incomeVsExpenses: DashboardChartPointDto[];
      spendByAccount: DashboardChartPointDto[];
    };
  };
  anomalies: {
    items: DetectedAnomalyDto[];
    alertStatuses: DashboardAlertStatusDto[];
  };
}
```

`transactionCount` comes from the selected Phase 4 account-statement result.
`chartScales` contains non-financial display ratios only. The server derives
`valuePermille` and display-ready `valuePercent` strings from existing DTO minor
unit strings using bigint-compatible arithmetic. The browser uses those strings
only for bar widths and never as financial amounts.

## Trader-Facing Redesign

The dashboard has now been refactored onto the shared KasiCash premium design
system used by the public website and auth pages. It is designed for an
informal South African trader using a phone first. The hierarchy is:

1. one plain-language answer for the selected period;
2. supporting money cards;
3. an explicit reconciliation: Sales minus Costs equals Profit;
4. quick ranges for `1W`, `1M`, `3M`, and `1Y`, plus one `Update view` action;
5. charts with readable rand values;
6. details and alerts.

`ALL` is intentionally not shown yet because `DashboardService` caps dashboard
periods at 366 days. A real all-time selector needs a bounded
earliest-posted-record read model or endpoint; faking it would mislead traders.

The copy intentionally avoids internal phase labels, accounting-console wording,
and raw currency-code display. It also states that the dashboard is the trader's
own confirmed record and is not a lender, insurer, or government decision.

Type scale:

- headline: responsive 28-52px, used only for the one main answer;
- section headings: 18px;
- card labels/body: 13-15px;
- captions: 12-13px.

Semantic colour system:

- KasiCash brand green: `#00C853` for the logo `c`, primary actions, cash,
  profit, and money-in emphasis.
- KasiCash brand black: `#0E0E0E` for type, logo mark, and the main hero
  surface.
- KasiCash warm ivory: `#F7F6F1` for page surfaces and calm background space.
- costs/expenses: red (`--expense`) only where a negative/outflow meaning is
  needed.
- alerts/checks: amber (`--alert`) only for review/warning states.
- neutral text and borders are kept separate from financial meaning.

Brand expression:

- The dashboard and login use a text-based `Kc | KasiCash` lockup matching the
  supplied brand sheet, with the `c` in vivid green.
- The product tagline is `Simple to run. Easy to grow.`
- The shared system uses an SF Pro/system-first stack with Poppins as a
  brand-compatible fallback so it remains usable without external font
  downloads.

Responsive approach: mobile is the base layout with one column, full-width
filters, and thumb-sized controls. Wider screens progressively add two-column
filters, a five-card KPI row, and a 12-column detail grid. Tables are the only
regions allowed to scroll horizontally when content is wider than a phone.

## Front-End Stack And Components

The dashboard uses a mainstream, minimal web-platform stack served by NestJS:
TypeScript-generated HTML, CSS, and a small browser script. This avoids a second
build system while still keeping the UI typed and testable. A future React or
Next dashboard can replace the shell after product and deployment needs justify
the extra client toolchain.

Component structure:

- `LoginPage`: browser form for the existing Phase 9 session API. It posts to
  `/auth/login`, relies on the HttpOnly cookie set by the controller, and
  redirects to `/dashboard`. It does not store bearer tokens in browser storage.
- `DashboardShell`: sticky brand header, loading/error root, and responsive main
  content area.
- `FilterBar`: plain-language date, grouping, cash-account, and as-at controls.
  A single `Update view` action calls `/dashboard/api/overview`; the browser does
  not recompute data.
- `HeadlineInsight`: summarizes the existing income-statement figures in words.
- `KpiGrid`: cash in hand, sales, costs, profit, and selected-account money
  movement count.
- `ReconciliationPanel`: shows Sales minus Costs equals Profit and explains why
  profit and cash in hand can differ.
- `TrendPanels`: cash trend and sales-vs-costs charts using server-provided
  chart scales plus existing service money DTOs for visible value labels.
- `SpendPanels`: spend breakdown and cost detail table.
- `MovementPanel`: account statement lines with plain labels (`In or out`, `Cash
after`).
- `AlertPanel`: current anomalies in plain "Things to check" language.

## Visual And UX Approach

- The layout is dense but calm: sticky brand header, mobile-first flow,
  responsive grid, high-contrast semantic colors, and 8px panels.
- Cash, sales, costs, and profit are visually distinct and always labelled with
  South African rand display strings.
- Empty/new-business state is explicit and honest: keep recording and the region
  will fill in.
- Chart and table empty states are specific: no cash movement, no sales/costs,
  no costs recorded, no money movements, or no unusual activity to check.
- Loading and error states are rendered inside the dashboard root and do not
  expose raw exception details.
- Charts display value labels. Single-point charts collapse to a compact reading
  instead of wasting a full chart region.
- The design was checked at a phone viewport with no horizontal body overflow; a
  formal accessibility audit remains deferred.

## Money Rendering Boundary

The browser receives existing read-service `MoneyDto` objects and formats the
service-provided formatted string for South African display at the view boundary:
`ZAR 2030.00` becomes `R 2 030.00`, and negative values become `-R 420.00`. It
does not access minor-unit fields, sum, average, round, parse with `parseFloat`,
call `Number()` for money, or convert money to JavaScript floating-point values.
Any visual scaling is precomputed on the server from bigint-compatible strings
and is not shown as a financial amount.

## Read-Only Proof Points

- Dashboard BFF methods call only P4/P6/P7 read methods or a read-only alert
  metadata query.
- Alert status metadata uses `SET TRANSACTION READ ONLY`.
- The integration test authenticates real principals, tries manipulated tenant
  parameters, and verifies only the authenticated tenant's real Postgres data is
  returned.
- Front-end tests assert formatted DTO money appears, raw minor units do not
  appear, and the browser script contains no money parsing helpers.

## Deferred

- Dashboard write actions; future writes must still use confirm-then-post.
- Real-time dashboard updates and push refresh.
- Multi-user RBAC beyond the current one-principal/one-business model.
- I18n/localized dashboard chrome beyond existing currency-aware DTO strings.
- Formal accessibility audit and assisted-technology pass.
- Richer charting library only after tests continue to forbid client-side money
  aggregation or float money.
