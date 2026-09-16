# KasiCash AI Site Visual Review - Round 3 Delta Prompt

You are a senior product designer, front-end engineer, and fintech trust-copy reviewer. Perform a round-3 delta review of the supplied KasiCash archive.

## Context

This is not a full re-review from zero. Round 2 rated the visual remediation 7.6/10 and found three required fixes before visual sign-off:

1. Mobile navigation existed in the DOM but was hidden at every viewport.
2. Small green labels on black surfaces used `#006F38`, which failed contrast.
3. Public acquisition language still said `Start sign up` even though setup is a manual email-draft flow.

The implementation claims those three blockers are now remediated, while preserving the existing read-only dashboard and tenant boundaries.

## Files To Inspect First

- `src/design-system/kasicash-design-system.ts`
- `src/design-system/kasicash-design-system.spec.ts`
- `src/public-site/public-site.frontend.ts`
- `src/public-site/public-site.frontend.spec.ts`
- `src/auth/auth.frontend.ts`
- `src/auth/auth.frontend.spec.ts`
- `src/app.controller.spec.ts`
- `PREMIUM_APP_REDESIGN_DESIGN.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`

If static HTML snapshots are supplied, inspect:

- `html-snapshots/home.html`
- `html-snapshots/signup.html`
- `html-snapshots/login.html`
- `html-snapshots/about.html`
- `html-snapshots/dashboard-rendered.html`

## Required Delta Checks

1. Receipt-check the archive and confirm the required files and snapshots are present.
2. Verify `.mobile-nav` is actually visible below the desktop breakpoint, not merely present in the DOM.
3. Verify mobile navigation includes at least `About` and `Dashboard login`, plus the primary public support/product routes.
4. Verify the desktop/tablet header no longer repeats `Sign up` in both the nav and the primary CTA, and that the breakpoint does not create a cramped 720px header.
5. Verify public acquisition language uses `Request setup` instead of `Start sign up` or instant-account wording.
6. Verify the signup page clearly explains that the form opens an email draft and the user must review and press Send.
7. Verify a visible `hello@kasicash.co.za` fallback is present for devices without a configured mail client.
8. Verify small green labels on light surfaces use accessible darker green and small green labels on black surfaces use a contrast-safe vivid green.
9. Verify the About page tone no longer uses the `Not accounting theatre` heading and still retains a specific KasiCash trader voice.
10. Verify the tests now catch the mobile-nav visibility/link regression, not only the existence of a `.mobile-nav` selector.

## Regression Checks

Confirm the fixes did not regress the previously accepted items:

- Desktop login/signup split is a real dark panel, not a viewport gradient that can put white copy on ivory.
- Mobile homepage still shows product/device identity.
- Dashboard remains calmer and less card-heavy.
- Mobile money movements still render as rows, not a squeezed table.
- Public pages still contain no fake financial amounts.
- Public pages still avoid lender, insurer, government, credit-decision, wallet, or guarantee claims.
- Dashboard routes remain read-only and backed by existing services.
- No client-side money aggregation, no float money, and no fabricated financial figures.
- Tenant scoping remains server-side and non-overridable by the browser.

## Tests

Run or review evidence for:

- focused renderer/controller tests;
- full Jest suite;
- Nest build;
- ESLint;
- text verification;
- static route smoke checks if a local server can run.

If dependencies, Docker, Postgres, or browser rendering are unavailable, state the limitation clearly rather than treating inspection as green CI.

## Output Format

Provide:

1. Receipt check.
2. Delta findings by severity.
3. Pass/fail status for each round-2 blocker.
4. Regression findings.
5. Test status and environment limits.
6. Rating out of 10.
7. Verdict on whether visual remediation is complete, pending formal legal review, accessibility/device testing, deployment validation, and green real-PostgreSQL CI.

Hunt especially for: hidden mobile nav, missing About/Dashboard login mobile links, dark-green-on-black contrast failure, signup wording that implies instant account creation, mailto ambiguity, stale `Start sign up` wording, public fake money, new write paths, client-side financial math, and cross-tenant leaks.
