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
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
INGESTION_RECOVERY_DISABLED=
```

For local/Codespaces smoke testing only, set:

```bash
KASICASH_DEV_TOOLS=true
```

Restart `npm run start:dev` after changing `.env`.

## Smoke Test The WhatsApp Flow

After Postgres is running, migrations are applied, and the API is running:

```bash
curl -X POST http://127.0.0.1:3000/dev/whatsapp/text \
  -H "Content-Type: application/json" \
  -d '{"text":"sold airtime R30"}'
```

Expected result: JSON with `ok: true`, `stored: true`, and `processed: true`.

For Codespaces, use the forwarded port URL instead of `127.0.0.1`, for example:

```bash
curl -X POST https://YOUR-CODESPACE-3000.app.github.dev/dev/whatsapp/text \
  -H "Content-Type: application/json" \
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

## Tests

```bash
npm run build
npm run lint
npm test -- --runInBand
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
