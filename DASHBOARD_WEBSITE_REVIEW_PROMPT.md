# Independent Review Prompt: Dashboard Website Handoff

You are a senior full-stack/security engineer reviewing the KasiCash dashboard
website handoff.

Start with a receipt check. Confirm these files exist:

- `src/auth/auth.frontend.ts`
- `src/auth/auth.frontend.spec.ts`
- `src/auth/auth.controller.ts`
- `src/auth/create-auth-principal.cli.ts`
- `src/dashboard/*`
- `Dockerfile`
- `.dockerignore`
- `DEPLOYMENT_DASHBOARD.md`
- `PHASE8_DASHBOARD_DESIGN.md`
- `PHASE8_REVIEW_PROMPT.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `README.md`

Review scope:

- Verify `GET /auth/login` is only a browser wrapper around the existing
  `POST /auth/login` session API.
- Verify the login page relies on the existing HttpOnly cookie flow, redirects
  to `/dashboard`, and does not store bearer tokens in `localStorage`,
  `sessionStorage`, or `document.cookie`.
- Verify the dashboard remains read-only: no `LedgerService` call, no mutation
  route, no direct financial table writes, and no bypass around
  confirm-then-post.
- Verify dashboard figures still come from Phase 4 reports, Phase 6 analytics,
  and Phase 7 anomalies, with no client-side money recomputation.
- Verify server-side tenant scoping is non-overridable and comes from the
  authenticated principal, not request query/body data.
- Verify `src/auth/create-auth-principal.cli.ts` writes only auth metadata for
  an existing `businesses.id`; it must not write ledger transactions, entries,
  proposals, reports, analytics, or balances.
- Verify `Dockerfile` and `.dockerignore` do not copy `.env`, `.git`,
  `node_modules`, `dist`, coverage, logs, or secrets from the local workspace.
- Verify `DEPLOYMENT_DASHBOARD.md` is honest that the real app requires a
  Node/container host plus PostgreSQL and cannot be hosted as the real app on
  GitHub Pages.
- Verify production deployment guidance does not weaken secure cookies,
  PostgreSQL-only mode, WhatsApp Cloud fail-closed config, auth, tenant
  isolation, or ledger invariants.

Check tests:

- Build and lint should pass.
- Unit tests should include `auth.frontend.spec.ts` and dashboard renderer/
  service tests.
- The dashboard Testcontainers integration should prove authenticated tenant
  isolation, reversal-netted figures, pending proposal exclusion, and
  other-tenant exclusion against real PostgreSQL when a container runtime is
  available.

Hunt for auth bypass, unauthenticated dashboard exposure, bearer-token storage,
secret leakage, client-side money math, cross-tenant access, accidental
financial writes from deployment/admin tooling, and Docker images that include
local secrets.

Rate correctness, security, deployability, and review readiness. Give a verdict
pending green CI and real PostgreSQL/Testcontainers execution.
