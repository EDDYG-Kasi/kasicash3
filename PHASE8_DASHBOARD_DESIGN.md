# Phase 8 Web Dashboard Design

> Historical design note: Phase 9 has replaced the temporary Phase 8 tenant
> stub described below. The current implementation requires `AuthGuard` and
> derives business, currency, and timezone from the authenticated principal.
> No Phase 8 server-configured tenant override remains on dashboard routes.

Phase 8 adds a read-only web dashboard and backend-for-frontend (BFF) for one
business. It is a view over existing read services only: Phase 4 reports, Phase
6 analytics, and Phase 7 anomaly detection/alert metadata. It introduces no
ledger write path and no dashboard shortcut around the WhatsApp
confirm-then-post flow.

## Governing Rules

- Dashboard endpoints are read-only. They do not call `LedgerService`, do not
  write `transactions`, `entries`, or `accounts`, and do not expose mutation
  routes.
- Financial figures come from existing read services:
  - Phase 4 `ReportsService` for cash position, income statement, and account
    statement.
  - Phase 6 `AnalyticsService` for cash-balance, income-vs-expenses, and
    spend-by-account chart data.
  - Phase 7 `AnomalyService.detectAnomalies()` for current anomaly facts.
- Alert status metadata is read from `anomaly_alerts` with `SET TRANSACTION READ
  ONLY`; this is notification metadata, not a financial record.
- The dashboard never accepts `businessId`, `currency`, or `timezone` from the
  client. During Phase 8 those came from the temporary server-side stub; the
  current system derives them from the authenticated principal.
- Real authentication/authorization is Phase 9. Phase 8 endpoints are guarded
  by `KASICASH_DASHBOARD_ENABLED=true` plus a configured
  `KASICASH_DASHBOARD_BUSINESS_ID`. Without that explicit server config the
  routes return 503 and must not be treated as production-exposed.
- The front end displays `MoneyDto.formatted` strings returned by read services.
  It never aggregates money, parses money as `Number`, uses floats, or computes
  financial totals.

## Server-Side Tenant Guard

`DashboardTenantContextService` resolves:

```text
businessId = KASICASH_DASHBOARD_BUSINESS_ID
currency   = KASICASH_DASHBOARD_CURRENCY || ZAR
timezone   = KASICASH_DASHBOARD_TIMEZONE || Africa/Johannesburg
```

`DashboardTenantGuard` attaches that context to each `/dashboard` request. Query
parameters named `businessId`, `currency`, or `timezone` are ignored. This is an
explicit Phase 8 stub only. Phase 9 must replace it with authenticated
user-to-business authorization and keep the same server-side non-overridable
tenant invariant.

## Endpoint Contract

All endpoints are under `/dashboard` and require the Phase 8 tenant guard.

| Endpoint | Client Parameters | Existing Service Used | Output |
|---|---|---|---|
| `GET /dashboard` | none | none | HTML shell and static client |
| `GET /dashboard/assets/app.js` | none | none | Browser script |
| `GET /dashboard/api/overview` | `from`, `to`, `granularity`, `accountId`, `limit`, `offset`, `asOfLocalDate` | P4 + P6 + P7 | Combined dashboard DTO |
| `GET /dashboard/api/cash-position` | none | `ReportsService.getCashPosition` | `CashPositionReportDto` |
| `GET /dashboard/api/income-statement` | `from`, `to` | `ReportsService.getIncomeStatement` | `IncomeStatementReportDto` |
| `GET /dashboard/api/accounts/:accountId/statement` | `from`, `to`, `limit`, `offset` | `ReportsService.getAccountStatement` | `AccountStatementReportDto` |
| `GET /dashboard/api/analytics/cash-balance` | `from`, `to`, `granularity` | `AnalyticsService.getCashBalanceSeries` | `CashBalanceSeriesDto` |
| `GET /dashboard/api/analytics/income-expenses` | `from`, `to`, `granularity` | `AnalyticsService.getIncomeVsExpensesSeries` | `IncomeExpenseSeriesDto` |
| `GET /dashboard/api/analytics/spend-by-account` | `from`, `to` | `AnalyticsService.getSpendByAccountBreakdown` | `SpendByAccountBreakdownDto` |
| `GET /dashboard/api/anomalies` | `asOfLocalDate` | `AnomalyService.detectAnomalies` + read-only alert metadata query | Current anomalies and alert statuses |

`from` and `to` are local dates interpreted in the server-side business
timezone. If omitted, the BFF defaults to the last 30 local days ending today in
that timezone. `granularity` defaults to `day`.

## Overview DTO

`DashboardOverviewDto` reuses existing DTOs and adds only dashboard metadata:

```ts
{
  generatedAt: string;
  tenant: {
    businessId: string;
    currency: string;
    timezone: string;
    authBoundary: 'PHASE_8_SERVER_STUB_NOT_PRODUCTION_AUTH';
    productionReady: false;
  };
  period: { from: string; to: string; granularity: 'day' | 'week' | 'month' };
  cashPosition: CashPositionReportDto;
  incomeStatement: IncomeStatementReportDto;
  accountStatement: AccountStatementReportDto | null;
  analytics: {
    cashBalance: CashBalanceSeriesDto;
    incomeVsExpenses: IncomeExpenseSeriesDto;
    spendByAccount: SpendByAccountBreakdownDto;
    chartScales: DashboardChartScalesDto;
  };
  anomalies: {
    items: DetectedAnomalyDto[];
    alertStatuses: DashboardAlertStatusDto[];
  };
}
```

`chartScales` contains non-financial display ratios (`0..1000` permille)
computed server-side from existing DTO amount strings. The client uses those
only for bar widths/heights and never as displayed financial figures.

## Front-End Stack And Components

The Phase 8 front end is a dependency-free TypeScript-rendered dashboard served
by NestJS:

- `DashboardShell`: HTML, CSS, and a browser script from the backend.
- `OverviewPanel`: cash position, income statement, and statement excerpt.
- `SeriesPanel`: P6 cash balance and income/expense chart-series views.
- `SpendPanel`: spend-by-account breakdown.
- `AnomalyPanel`: current P7 anomalies with alert status metadata.

This keeps the surface small and testable without adding a second build system.
Phase 9/10 may replace it with a richer React/Next dashboard once auth, RBAC,
and deployment boundaries are settled.

## Money Rendering

The client renders `MoneyDto.formatted` exactly as supplied in JSON. It does not
sum, average, round, parse with `parseFloat`, or convert money to JavaScript
floating-point values. Any visual scaling is precomputed on the server from
bigint-compatible strings and is not shown as a financial amount.

## Deferred

- Real authentication, authorization, RBAC, and business membership in Phase 9.
- Any dashboard write actions; future writes must still use confirm-then-post.
- Real-time updates, push notifications, or live chart refresh.
- Mobile/responsive polish beyond the simple Phase 8 layout.
- I18n/localized currencies beyond the existing formatted DTO strings.
- Rich charting library once client-side money-math constraints are encoded in
  component tests.
