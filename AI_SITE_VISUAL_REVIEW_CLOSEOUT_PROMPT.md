# KasiCash AI Site Visual Review - Closeout Prompt

You are a senior product designer, front-end engineer, and fintech trust-copy reviewer. Perform a closeout delta review of the supplied KasiCash archive.

## Context

Round 3 rated the KasiCash visual remediation **8.8/10** and concluded that the three round-2 visual blockers were resolved:

1. Mobile navigation is visible below the desktop breakpoint and includes About plus Dashboard login.
2. Small green labels use contrast-correct treatment on light and black surfaces.
3. Public acquisition language says `Request setup` and explains the manual email-draft flow.

Round 3 left only two tiny terminology-polish notes:

- the setup page browser title still said `KasiCash Sign Up`;
- the generated mailto body still started `Hi KasiCash, I want to sign up.`

The implementation claims both are now fixed.

## Files To Inspect First

- `src/auth/auth.frontend.ts`
- `src/auth/auth.frontend.spec.ts`
- `src/design-system/kasicash-design-system.ts`
- `src/public-site/public-site.frontend.ts`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `AI_SITE_VISUAL_REVIEW_ROUND3_PROMPT.md`

If static HTML snapshots are supplied, inspect:

- `html-snapshots/signup.html`
- `html-snapshots/login.html`
- `html-snapshots/home.html`
- `html-snapshots/about.html`
- `html-snapshots/dashboard-rendered.html`

## Required Closeout Checks

1. Receipt-check the archive and confirm the required files and snapshots are present.
2. Verify the setup page browser title is now `KasiCash Setup Request`, not `KasiCash Sign Up`.
3. Verify the generated email body says `Hi KasiCash, I'd like to request setup.`, not `I want to sign up.`
4. Verify visible UI acquisition language still uses `Request setup`.
5. Verify signup still clearly says the flow opens an email draft and the user must review it and press Send.
6. Verify the visible `hello@kasicash.co.za` fallback still exists.
7. Verify the previous round-3 pass conditions did not regress:
   - mobile nav visible below desktop breakpoint;
   - About and Dashboard login present in mobile nav;
   - desktop nav switches at a wider breakpoint and does not duplicate Sign up;
   - dark-surface green contrast uses vivid green;
   - About heading no longer says `Not accounting theatre`;
   - dashboard remains read-only and service-backed;
   - no client-side money aggregation, no float money, no fabricated public financial figures;
   - tenant scoping remains server-side and non-overridable.

## Tests

Run or review evidence for:

- focused renderer/controller tests;
- full Jest suite;
- Nest build;
- ESLint;
- text verification;
- local route/content smoke checks if a server can run.

If dependencies, Docker, Postgres, or browser rendering are unavailable, state the limitation clearly rather than treating inspection as green CI.

## Output Format

Provide:

1. Receipt check.
2. Closeout findings by severity.
3. Pass/fail status for the two terminology-polish notes.
4. Regression findings.
5. Test status and environment limits.
6. Rating out of 10.
7. Verdict on whether the visual remediation can be closed, pending formal legal review, accessibility/device testing, deployment validation, and green real-PostgreSQL CI.

Hunt especially for: residual `KasiCash Sign Up`, residual `I want to sign up`, hidden mobile nav, missing About/Dashboard login mobile links, dark-green-on-black contrast failure, mailto ambiguity, public fake money, new write paths, client-side financial math, and cross-tenant leaks.
