# KasiCash Public Website Design

## Purpose

`GET /` is now the public KasiCash marketing webpage. It is intentionally
separate from the authenticated dashboard and from all financial read/write
services. It explains the product, routes new users to `/auth/signup`, keeps
`/auth/login` for existing users, and does not compute, fetch, or display
ledger-derived financial figures.

## Design Rationale

- **Hierarchy:** one brand-led hero first (`KasiCash`), then the plain product
  promise, one primary CTA, trust signals, how-it-works steps, product preview,
  pricing guidance, trust boundaries, and a closing CTA.
- **Brand system:** follows the supplied KasiCash identity: Vivid Green
  `#00C853`, Black `#0E0E0E`, Warm Ivory `#F7F6F1`, and a Poppins-first font
  stack. Green is reserved for CTAs, accents, and the product signal.
- **Mobile-first layout:** the page is single-column by default with 44px+
  touch targets, then expands to multi-column grids on wider screens.
- **Product visual:** the hero and product sections show WhatsApp/dashboard
  shaped UI without real or fabricated money values.
- **Trust copy:** the page clearly says the product is the trader's own record
  system, not a lender, insurer, government promise, or external decision.

## Routes

- `GET /` returns the public website HTML.
- `GET /pricing`, `GET /fees-limits`, `GET /security`, `GET /help`,
  `GET /contact`, `GET /about`, `GET /accessibility`,
  `GET /legal/privacy`, `GET /legal/terms`, and `GET /legal/cookies` return
  static product, trust, support, and legal-review draft pages.
- `GET /api` preserves the machine-readable root response:
  `{ ok: true, service: "kasicash-api" }`.
- `GET /auth/signup` serves a setup-request page that opens a user-directed
  mailto request instead of creating tenants or writing server data.
- `/auth/login`, `/dashboard`, `/health`, `/ready`, `/webhooks/whatsapp`, and
  all existing API routes remain available.

## Financial Boundary

The public website is static presentation only:

- no database queries
- no calls to P4/P6/P7 read services
- no ledger writes
- no dashboard endpoint calls
- no client-side money formatting or arithmetic
- no displayed rand examples or fake business figures

## Accessibility Notes

- Semantic headings and labelled navigation are used.
- CTAs meet mobile touch-target sizing.
- Focus-visible outlines are explicit.
- The black/ivory/green palette is used with high-contrast text treatment.

## Deferred

- Real local trader photography or generated bitmap campaign imagery.
- Formal accessibility audit.
- CMS/templates for reusable public content management.
- Formal legal/commercial review for privacy, terms, cookies, pricing, fees,
  contact, support, POPIA, PAIA, and production claims.
