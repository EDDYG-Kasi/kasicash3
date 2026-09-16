# Dashboard Website Deployment

KasiCash's dashboard is a real backend website, not a static GitHub Pages app.
It needs the NestJS API, PostgreSQL, migrations, and authenticated browser
sessions. The public browser flow is:

```text
GET /auth/login  ->  POST /auth/login  ->  GET /dashboard
```

The dashboard remains read-only. It calls existing Phase 4 reports, Phase 6
analytics, and Phase 7 anomaly detection. It adds no ledger write route.

## Hosting Shape

Use a host that can run a long-lived Node.js process or Docker container plus a
managed PostgreSQL database. GitHub Pages cannot run this application because it
does not provide a Node server, private environment variables, or PostgreSQL.

The included `Dockerfile` builds a production image that starts:

```text
node dist/main.js
```

Run migrations before starting or as the platform's release command:

```bash
node dist/database/migrate.js up
```

## Required Runtime Configuration

Set these through the host's secret/environment UI, never in the repository:

```bash
NODE_ENV=production
PORT=3000
KASICASH_DB_MODE=postgres
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
KASICASH_AUTH_COOKIE_SECURE=true
KASICASH_TRUST_PROXY_HOPS=1
KASICASH_DEV_TOOLS=false
KASICASH_WHATSAPP_MODE=cloud
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_GRAPH_API_VERSION=v24.0
WHATSAPP_SEND_TIMEOUT_MS=5000
```

Production startup intentionally fails closed if secure cookies, PostgreSQL, or
required WhatsApp Cloud settings are missing. For a private staging dashboard
that is not production, keep `NODE_ENV` non-production and use the existing
development safeguards deliberately.

## First Dashboard User

The dashboard principal must be tied to an existing `businesses.id`. Usually
the business is created through WhatsApp onboarding. Once the business exists
and migrations are current, create the first auth principal:

```bash
npm run auth:create-principal -- \
  --email owner@example.com \
  --password "use-a-long-unique-password" \
  --business-id BUSINESS_UUID \
  --currency ZAR \
  --timezone Africa/Johannesburg
```

Inside the production Docker image, use the compiled equivalent:

```bash
node dist/auth/create-auth-principal.cli.js \
  --email owner@example.com \
  --password "use-a-long-unique-password" \
  --business-id BUSINESS_UUID \
  --currency ZAR \
  --timezone Africa/Johannesburg
```

This writes only `auth_principals` metadata. It never writes ledger
transactions, entries, proposals, reports, analytics, or balances.

## Operator Smoke Test

After the service is up:

1. Open `https://YOUR-HOST/health`; expect JSON liveness output.
2. Open `https://YOUR-HOST/auth/login`.
3. Sign in with the created principal.
4. Confirm the browser lands on `https://YOUR-HOST/dashboard`.
5. Check that manipulated tenant query strings do not change the displayed
   business. Tenant identity comes only from the authenticated principal.

## Security Notes

- Do not expose `/dashboard` without authentication.
- Do not run production with `KASICASH_DEV_TOOLS=true`.
- Do not commit `.env`, access tokens, passwords, database URLs, or generated
  session tokens.
- Do not use GitHub Pages for the real app; it would only be a static mock and
  would not enforce the KasiCash ledger/auth invariants.
