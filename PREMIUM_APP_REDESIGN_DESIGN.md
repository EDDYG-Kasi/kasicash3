# Premium App Redesign Design

## Goal

This pass refactors the visible KasiCash product so it no longer feels like a
developer debug surface. The target is a restrained, phone-first fintech
experience: clear hierarchy, consistent brand, plain trader language, and
careful trust copy. It does not change financial behaviour.

## Hard Boundaries

- Public pages are static presentation only. They do not query the database,
  call read services, post transactions, create tenants, or show fabricated
  money examples.
- The authenticated dashboard remains a read-only view over the existing Phase
  4 reports, Phase 6 analytics, and Phase 7 anomaly services.
- Dashboard tenant context still comes from `AuthGuard` plus
  `DashboardTenantGuard`; browser-supplied tenant fields are ignored.
- The browser still formats existing read-service `MoneyDto.formatted` strings
  at the view boundary and does not parse minor units, aggregate money, use
  floats, or compute financial totals.
- Sign-up remains a manual setup-request mailto flow. It does not create
  accounts, tenants, sessions, or ledger records.

## Design System

The shared renderer in `src/design-system/kasicash-design-system.ts` defines
the global visual language:

- type: SF Pro/system stack first, with Poppins retained as a brand-compatible
  fallback;
- brand: vivid green `#00C853`, black `#0E0E0E`, warm ivory `#F7F6F1`;
- semantic colours: income/cash/profit green, expense red, warning amber,
  neutral text/borders for non-financial states;
- accessibility green: small labels on light surfaces use the darker
  `#006F38` variant, while small labels on black surfaces use vivid
  `#00C853` for WCAG-friendly contrast;
- spacing: small token scale from 4px to 64px;
- radii: 8px, 12px, 18px, and 28px, with repeated tool/card surfaces staying
  disciplined;
- controls: 46px minimum touch targets, visible focus rings, pill CTAs, neutral
  secondary actions;
- states: loading, empty, error, and reduced-motion support;
- dark mode: token-level dark palette through `prefers-color-scheme`.

The shared system owns the `Kc | KasiCash` brand lockup, public header/footer,
legal/trust page shell, and dashboard CSS overrides. This removes the earlier
pattern where every page carried its own unrelated styling.

## Public Website Routes

The public site now covers the requested product/trust/legal journey:

| Route | Purpose | Data Boundary |
| --- | --- | --- |
| `GET /` | Product home and sign-up entry point | Static only |
| `GET /pricing` | Pricing status and provider-cost caveats | Static only |
| `GET /fees-limits` | Plain record-system limits and no-wallet caveat | Static only |
| `GET /security` | Technical trust centre without certification claims | Static only |
| `GET /help` | Trader FAQ and dashboard explanation | Static only |
| `GET /contact` | Setup/support/security contact routing | Static only |
| `GET /about` | Product/design/engineering beliefs | Static only |
| `GET /accessibility` | Accessibility posture and remaining audit work | Static only |
| `GET /legal/privacy` | Privacy draft placeholder | Static only |
| `GET /legal/terms` | Terms draft placeholder | Static only |
| `GET /legal/cookies` | Essential-cookie notice | Static only |

Legal and commercial claims are deliberately limited. The pages state when text
is a draft or requires legal review instead of inventing final policy language.
The Privacy, Terms of service, Cookies, and About pages now carry a
fuller KasiCash voice: plain, trader-respectful, and specific about the product
boundary without making bank, lender, insurer, government, certification, or
legal-finality claims.

## Public Website Composition

The homepage no longer uses a generic floating-card SaaS layout. It is composed
as a real product page:

- a full-width hero with a KasiCash product/device scene instead of a card;
- a simplified mobile version of the product/device scene so phones still show
  the WhatsApp-to-record product identity above the fold;
- a black proof band using brand contrast, not decorative glass;
- a timeline-style daily flow instead of feature tiles;
- a compact product status strip instead of a dashboard mock with fake money;
- a trust-boundary list with separators instead of three floating bubbles;
- a closing setup band that explains why signup is manual.

The header now includes a visible horizontal mobile navigation row below the
desktop breakpoint. Phone users can reach Pricing, Fees and limits, Security,
About, Help, and Dashboard login without hunting through the footer. Desktop
uses a wider breakpoint and one `Request setup` CTA rather than repeating
sign-up language in both the navigation and primary button.

The legal/about routes use a document-style layout with an accessible table of
contents and a bounded reading column, matching the brief's requirement for
structured premium trust pages rather than walls of text or repeated cards.

## Auth Experience

The auth pages use a real two-column layout instead of a viewport-relative
black/ivory gradient. The dark introduction panel is part of the same grid as
the form, so desktop copy cannot drift into the light surface. Mobile keeps the
black intro and brings the setup/login form forward as a clean light sheet.

Sign-up language now says `Request setup` rather than implying instant account
creation. The form opens an email draft, explicitly tells the user to review
and press Send, provides a visible `hello@kasicash.co.za` fallback, and does
not create a tenant, account, session, ledger entry, or financial record.

## Dashboard Experience

The dashboard keeps the existing service and DTO wiring, but now presents it as
a trader product:

1. one plain-language headline answer for the selected period;
2. quick date ranges and one clear `Update view` action;
3. one continuous KPI summary surface for cash in hand, sales, costs, profit,
   and movement count;
4. a reconciliation panel: Sales minus Costs equals Profit, plus why Profit and
   Cash in hand can differ;
5. readable charts with visible rand labels from service DTOs;
6. cost, cash-account, account-statement, and alert detail after the overview;
7. a phone-specific money-movement row layout instead of squeezing the desktop
   statement table into 320-430px screens.

The quick range links are date-query shortcuts for `1W`, `1M`, `3M`, and `1Y`.
`ALL` is not implemented because `DashboardService` intentionally caps dashboard
periods at 366 days and does not expose an earliest-posted-entry endpoint. A
fake all-time link would either fail or mislead; the real all-time selector is
logged as deferred work.

## Accessibility And Mobile Approach

Mobile is the base layout: single column, thumb-sized controls, visible product
identity, readable type, horizontal main navigation, and no squeezed transaction
table. Desktop progressively adds multi-column filters, a five-column KPI row,
and a 12-column detail grid. Charts include text values and semantic labels so
colour is never the only carrier of meaning.

## Figure Provenance

- Current cash and cash-account balances: `ReportsService.getCashPosition`.
- Sales, costs, and profit: `ReportsService.getIncomeStatement`.
- Money movements and cash after each row: `ReportsService.getAccountStatement`.
- Cash trend, income-vs-costs trend, and spend breakdown:
  `AnalyticsService` via `DashboardService`.
- Alerts/things to check: `AnomalyService.detectAnomalies` plus read-only alert
  metadata.
- Chart widths: non-financial display percentages derived server-side from
  bigint-compatible DTO strings.

No dashboard figure is fabricated by the client.

## Verification

- Focused renderer/controller test run:
  `src/design-system/kasicash-design-system.spec.ts`,
  `src/public-site/public-site.frontend.spec.ts`, `src/app.controller.spec.ts`,
  `src/auth/auth.frontend.spec.ts`, `src/auth/auth.controller.spec.ts`, and
  `src/dashboard/dashboard.frontend.spec.ts`.
- Additional build/lint/text verification should be run after all docs are
  updated.

## Deferred

- Formal legal review for pricing, fees, privacy, terms, cookies, contact, and
  support commitments.
- Real brand imagery or approved generated campaign photography.
- Formal accessibility audit and physical-device testing.
- All-time dashboard range after a bounded earliest-entry/read-model design.
- A richer charting/front-end framework only if it preserves server-derived
  money figures and no client-side financial recomputation.
