You are a senior product designer, front-end engineer, and financial-systems reviewer. Perform an independent review of the KasiCash premium app redesign.

Receipt check first. Confirm the archive contains the updated renderer, route, test, and documentation files, including:

- `src/design-system/kasicash-design-system.ts`
- `src/design-system/kasicash-design-system.spec.ts`
- `src/public-site/public-site.frontend.ts`
- `src/public-site/public-site.frontend.spec.ts`
- `src/auth/auth.frontend.ts`
- `src/auth/auth.frontend.spec.ts`
- `src/auth/auth.controller.ts`
- `src/auth/auth.controller.spec.ts`
- `src/app.controller.ts`
- `src/app.controller.spec.ts`
- `src/dashboard/dashboard.frontend.ts`
- `src/dashboard/dashboard.frontend.spec.ts`
- `PREMIUM_APP_REDESIGN_DESIGN.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TECH_DEBT.md`

Review scope:

1. Verify the redesign is presentation-only and preserves financial behaviour:
   no new ledger write path, no dashboard write action, no mutation of reports,
   analytics, anomaly detection, ingestion, auth, or ledger core.
2. Verify every dashboard figure still comes from the existing read services
   through the existing DTOs: Phase 4 reports, Phase 6 analytics, and Phase 7
   anomalies. Hunt for fabricated figures, hard-coded demo money, client-side
   financial totals, or drift from service values.
3. Verify money display uses the South African presentation boundary
   (`R 2 030.00`) and does not expose raw `ZAR 2030.00` or minor units in the
   trader UI. Confirm the browser script does not use `parseFloat`, `Number`,
   `.toFixed`, raw `amountMinor`, or any other client-side money math.
4. Verify tenant isolation remains server-side and non-overridable. Confirm
   `/dashboard` routes still require auth and the tenant context is derived from
   the authenticated principal, not query parameters.
5. Review the product design quality against the brief: premium restrained
   fintech, mobile-first, coherent type scale, consistent spacing/radii,
   semantic colour use, accessible contrast/focus, no random gradients/glass,
   no emoji, no internal phase/debug labels, and no developer-language UI.
   Specifically check that the public site is not a generic floating-card SaaS
   page and that cards are only used where a real framed component is needed.
6. Verify the public website journey is complete enough for review: Home,
   Pricing, Fees and limits, Security centre, Privacy, Terms, Cookie
   preferences, Help/FAQ, Contact, About, Accessibility, footer navigation, and
   sign-up/login routing.
7. Verify the static About, Privacy, Terms of service, and Cookie pages have
   enough substance and brand personality for a real trader-facing product,
   while remaining plain, specific, and understandable on a phone.
8. Verify legal/trust copy does not overclaim. It must not present KasiCash as a
   bank, lender, insurer, government decision, certification, guarantee, or
   final legal policy. Draft/legal-review caveats should be clear.
9. Verify loading, empty, and error states are explicit and honest on the
   dashboard, with chart labels or values visible and sparse data handled
   compactly.
10. Run the relevant tests if the environment supports it:
   - focused unit/render tests,
   - build,
   - lint,
   - repository text verification,
   - dashboard/public route smoke tests.
   If Testcontainers/PostgreSQL are unavailable, state that as an environment
   block, not a green CI verdict.

Be adversarial. Hunt for:

- any write or mutation introduced by the redesign;
- any client-side recomputation of financial values;
- any fake or demo money shown as real product data;
- any cross-tenant read path or client-selected tenant field;
- any stale internal labels such as `P4`, `P6`, `P7`, `Bucket`, `Delta`,
  `Running`, or `Read-only trader dashboard`;
- any generic bubble/card grid that violates the design brief's "less UI,
  fewer cards, Apple restraint" direction;
- any inaccessible chart, hidden value, poor contrast, broken mobile layout,
  clipped text, nested scroll trap, or inconsistent card/gutter system;
- any legal, pricing, security, or regulatory claim that needs evidence but is
  presented as final.

Return:

- receipt check;
- findings ordered by severity with file/line references;
- design-quality notes;
- test/CI status;
- rating out of 10;
- verdict on whether the redesign is acceptable pending green CI and formal
  legal/accessibility review.
