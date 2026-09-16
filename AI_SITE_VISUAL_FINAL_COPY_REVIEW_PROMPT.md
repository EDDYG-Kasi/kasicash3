# KasiCash AI Site Visual Review - Final Copy Cleanup Prompt

You are a senior product designer, front-end engineer, and fintech trust-copy reviewer. Perform a narrow final delta review of the supplied KasiCash archive.

## Context

The previous closeout review rated the visual remediation **9.2/10** and said the visual-remediation work should be closed. It found no blocker involving mobile navigation, dark-surface green contrast, setup behaviour, dashboard read-only boundaries, client-side money math, fabricated public figures, or tenant scoping.

The only remaining polish note was that three public-content sentences still called `/auth/signup` the "sign-up page". The implementation claims those visible references now say `setup request page`.

## Files To Inspect First

- `src/public-site/public-site.frontend.ts`
- `src/public-site/public-site.frontend.spec.ts`
- `src/auth/auth.frontend.ts`
- `src/auth/auth.frontend.spec.ts`
- `src/design-system/kasicash-design-system.ts`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`

If static HTML snapshots are supplied, inspect:

- `html-snapshots/pricing.html`
- `html-snapshots/help.html`
- `html-snapshots/contact.html`
- `html-snapshots/signup.html`
- `html-snapshots/home.html`
- `html-snapshots/dashboard-rendered.html`

## Required Checks

1. Receipt-check the archive and confirm the listed files/snapshots are present.
2. Verify Pricing, Help, and Contact public copy now says `setup request page`, not `sign-up page`.
3. Verify tests cover the new setup-request wording and reject the old visible phrase.
4. Verify the already-accepted closeout items did not regress:
   - setup page title is `KasiCash Setup Request`;
   - generated email body says `Hi KasiCash, I'd like to request setup.`;
   - visible acquisition CTAs still say `Request setup`;
   - the signup page still says the flow opens an email draft and the user must review it and press Send;
   - visible `hello@kasicash.co.za` fallback remains;
   - mobile nav is visible below desktop breakpoint and includes About plus Dashboard login;
   - dark-surface green labels use vivid green;
   - About heading does not say `Not accounting theatre`;
   - dashboard remains GET/read-only and service-backed;
   - no client-side money aggregation, no float money, no fabricated public financial figures;
   - tenant scoping remains server-side and non-overridable.

## Tests

Run or review evidence for:

- focused public/auth renderer tests;
- full Jest suite;
- Nest build;
- ESLint;
- text verification;
- route/content smoke checks if a local server can run.

If dependencies, Docker, Postgres, or browser rendering are unavailable, state the limitation clearly rather than treating inspection as green CI.

## Output Format

Provide:

1. Receipt check.
2. Findings by severity.
3. Pass/fail status for the final copy cleanup.
4. Regression findings.
5. Test status and environment limits.
6. Rating out of 10.
7. Verdict on whether visual remediation remains closed, pending formal legal review, accessibility/device testing, production deployment validation, and green real-PostgreSQL CI.

Hunt especially for: visible `sign-up page` copy on public pages, stale `KasiCash Sign Up`, stale `I want to sign up`, hidden mobile nav, missing About/Dashboard login mobile links, dark-green-on-black contrast failure, mailto ambiguity, public fake money, new write paths, client-side financial math, and cross-tenant leaks.
