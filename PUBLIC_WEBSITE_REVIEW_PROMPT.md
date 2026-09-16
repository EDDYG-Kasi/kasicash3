# KasiCash Public Website Review Prompt

You are a senior product designer and full-stack reviewer. Perform an
independent review of the KasiCash public marketing webpage change.

## Receipt Check

Confirm the archive includes at least:

- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/public-site/public-site.frontend.ts`
- `src/public-site/public-site.frontend.spec.ts`
- `PUBLIC_WEBSITE_DESIGN.md`
- `PUBLIC_WEBSITE_REVIEW_PROMPT.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TECH_DEBT.md`

## Review Scope

This change turns `GET /` into a public KasiCash marketing webpage and preserves
the prior machine-readable root response at `GET /api`.

Verify:

- `GET /` is presentation-only and does not call the database, dashboard APIs,
  reports, analytics, anomalies, ingestion, auth mutation endpoints, or the
  ledger.
- No new financial write path exists.
- No ledger, report, analytics, or anomaly math was modified.
- The public page does not invent or display fake money figures.
- The page does not expose internal phase labels or debug language.
- The brand follows the KasiCash system: Vivid Green `#00C853`, Black
  `#0E0E0E`, Warm Ivory `#F7F6F1`, Poppins-first typography, Kc monogram, and
  "Simple to run. Easy to grow."
- The site is mobile-first, has one clear primary CTA, and uses plain trader
  language.
- Public CTAs take new users to `GET /auth/signup`, while existing users can
  still reach `GET /auth/login`.
- The sign-up page does not create tenants, sessions, ledger entries, or other
  server-side data; it only opens a user-directed setup request.
- Trust boundaries are honest: no lender/insurer/government guarantee, and the
  dashboard remains the trader's own records.
- `/auth/login`, `/dashboard`, `/health`, `/ready`, and WhatsApp webhook routes
  remain intact.

## Tests To Run

Run:

```bash
npm test -- --runInBand app.controller public-site.frontend auth.frontend auth.controller
npm run build
npm run lint
```

If a local server is available, also visually inspect:

```text
http://127.0.0.1:3000/
http://127.0.0.1:3000/auth/signup
http://127.0.0.1:3000/auth/login
http://127.0.0.1:3000/api
http://127.0.0.1:3000/dashboard
```

## Hunt For

- Any accidental ledger/dashboard/API call from the public page.
- Any client-side money arithmetic or fake financial figures.
- Any exposed secrets, tokens, phone numbers, or private trader data.
- Any regression of health, auth, dashboard, or webhook routes.
- Any mobile layout overflow or inaccessible contrast/focus state.

Rate the change and give a verdict pending green CI.
