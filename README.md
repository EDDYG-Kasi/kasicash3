# KasiCash API

NestJS backend for the KasiCash ledger and WhatsApp ingestion flow.

## Run Locally Or In Codespaces

```bash
npm ci
cp .env.example .env
npm run migration:run
npm run start:dev
```

The API listens on port `3000` by default.

PostgreSQL is mandatory. `KASICASH_DB_MODE` may be omitted or set to `postgres`;
`memory` and unknown values are rejected before Nest constructs the application.
Schema synchronization is never used.

Open these in a browser first:

```text
GET /
GET /health
```

Both should return JSON. If they do, the server is alive.

## Environment

Set these in `.env`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=kasicash
PORT=3000
KASICASH_DEV_TOOLS=false
KASICASH_DEV_TOOLS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=v24.0
WHATSAPP_SEND_TIMEOUT_MS=5000
INGESTION_RECOVERY_DISABLED=
```

For local/Codespaces smoke testing only, set:

```bash
KASICASH_DEV_TOOLS=true
KASICASH_DEV_TOOLS_TOKEN=replace-with-a-local-random-token
```

Restart `npm run start:dev` after changing `.env`.

## Smoke Test The WhatsApp Flow

After Postgres is running, migrations are applied, and the API is running:

```bash
curl -X POST http://127.0.0.1:3000/dev/whatsapp/text \
  -H "Content-Type: application/json" \
  -H "x-kasicash-dev-token: replace-with-a-local-random-token" \
  -d '{"text":"sold airtime R30"}'
```

Expected result: JSON with `ok: true`, `stored: true`, and `processed: true`.

For Codespaces, use the forwarded port URL instead of `127.0.0.1`, for example:

```bash
curl -X POST https://YOUR-CODESPACE-3000.app.github.dev/dev/whatsapp/text \
  -H "Content-Type: application/json" \
  -H "x-kasicash-dev-token: replace-with-a-local-random-token" \
  -d '{"text":"sold airtime R30"}'
```

## WhatsApp Webhook

Verification endpoint:

```text
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=hello
```

Event endpoint:

```text
POST /webhooks/whatsapp
```

`POST /webhooks/whatsapp` requires `x-hub-signature-256` using `WHATSAPP_APP_SECRET`.

## Manual WhatsApp Cloud Send Verification

Automated tests never call Meta. The Cloud API client is tested with stubs and a
local mock HTTP server. To exercise the real provider once, use only a Meta
sandbox/test number:

1. Set `KASICASH_WHATSAPP_MODE=cloud`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_API_VERSION`, and
   `WHATSAPP_SEND_TIMEOUT_MS` from a secret manager or local shell.
2. Keep `KASICASH_DEV_TOOLS=true` only in a non-production sandbox and protect
   it with `KASICASH_DEV_TOOLS_TOKEN`.
3. Start the app, then send one synthetic message:

```bash
curl -X POST http://127.0.0.1:3000/dev/whatsapp/text \
  -H "Content-Type: application/json" \
  -H "x-kasicash-dev-token: replace-with-a-local-random-token" \
  -d '{"from":"27831234567","text":"hello","messageId":"manual.cloud.1"}'
```

Expected result: the API returns processed JSON and the allowlisted test device
receives exactly one redacted-safe reply. Re-run the same `messageId` to confirm
idempotency prevents a second processing/send. Do not run this in CI and do not
use a production customer number for first verification.

## Tests

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run verify:text
```

Integration tests require Docker/Testcontainers:

```bash
npm run test:integration
```

## Migrations

```bash
npm run migration:run
npm run migration:revert
npm run migration:revert:all
```

Migration execution is transaction-per-migration. If the legacy integrity gate
blocks an upgrade, inspect bounded diagnostics without exposing row content:

```sql
SELECT category, row_count
FROM legacy_integrity_preflight
WHERE row_count > 0
ORDER BY category;
```

Do not fabricate provenance, currencies, or proposal facts to clear the gate.
Resolve ambiguous rows through an accountable operator process, call
`refresh_legacy_integrity_preflight()`, then rerun migrations.

`KASICASH_WEBHOOK_MAX_RAW_BYTES` is the authenticated application policy (up to
10 MiB). A small absolute transport envelope sits above it so authenticated
policy overflow can be stored and quarantined; larger bodies are rejected before
authentication as an anti-DoS boundary.

Production also fails startup unless developer tools are disabled, secure auth
cookies are enforced, WhatsApp Cloud mode is selected, complete WhatsApp
credentials in `.env.example` are present, and the outbound Graph version and
send timeout are valid.
