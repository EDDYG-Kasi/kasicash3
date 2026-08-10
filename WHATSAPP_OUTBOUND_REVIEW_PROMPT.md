# Independent Review Prompt: WhatsApp Outbound Integration Round 1

You are a senior backend/reliability/security reviewer. Review the KasiCash WhatsApp outbound integration that closes TD-3.

## Receipt Check

Confirm the archive includes at least:

- `src/ingestion/whatsapp.client.ts`
- `src/ingestion/ingestion.module.ts`
- `src/ingestion/ingestion.service.ts`
- `src/ingestion/whatsapp.client.spec.ts`
- `src/ingestion/ingestion.service.spec.ts`
- `src/config/runtime-config.ts`
- `src/config/runtime-config.spec.ts`
- `test/whatsapp-cloud-client.e2e-spec.ts`
- `.env.example`
- `WHATSAPP_OUTBOUND_INTEGRATION_DESIGN.md`
- `WHATSAPP_OUTBOUND_REVIEW_PROMPT.md`
- `DECISIONS.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TECH_DEBT.md`
- `README.md`
- `.github/workflows/ci.yml`

## Review Scope

Verify the new Cloud API send path:

- keeps the provider abstraction intact (`WhatsAppClient.sendText` remains the business boundary);
- uses the correct versioned Graph endpoint shape `/vX.Y/{phone_number_id}/messages`;
- sends the documented text-message JSON shape with `messaging_product`, `recipient_type`, `to`, `type`, and `text.preview_url/body`;
- sends the access token only in the `Authorization: Bearer` header;
- uses bounded timeouts;
- classifies success, retryable failure, permanent failure, timeout, network failure, and malformed provider success deterministically;
- sanitizes all errors/loggable fields so tokens, phone numbers, and message bodies cannot leak;
- validates local recipient/body shape before network send;
- never adds a ledger write or modifies ledger/ingestion idempotency semantics.

## Best-Effort Semantics

Prove a reply-send failure never:

- moves an inbound message out of `PROCESSED`;
- requeues or retries inbound processing;
- re-runs parsing/onboarding/ledger confirmation;
- creates a retry loop or double-send risk.

Check `src/ingestion/ingestion.service.ts` and the unit tests around send failure.

## CI And External Calls

Verify all automated tests use stubs or a local mock HTTP server only. CI must not call Meta or any live external endpoint. Inspect:

- `src/ingestion/whatsapp.client.spec.ts`
- `test/whatsapp-cloud-client.e2e-spec.ts`
- `.github/workflows/ci.yml`

Hunt for any environment variable, test hook, or default config that could make CI contact `graph.facebook.com`.

## Delivery Statuses

Verify TD-5 is either fully implemented or explicitly deferred. If deferred, confirm the rationale is sound: status callbacks need persisted provider `wamid`/outbound attempt metadata, and the current TD-3 slice should not add a drifting partial status store.

## Security/Privacy Hunt

Specifically hunt for:

- secrets in source, docs, tests, or logs;
- full phone numbers or message bodies in logs/errors;
- provider raw response body leakage;
- provider-specific details leaking into ingestion/business logic beyond the client module;
- retryable send errors that trigger inbound retry or ledger mutation;
- live external calls in CI;
- malformed Graph version or path injection risks;
- overly broad mock-base-url configuration exposed to production.

## Commands To Run

Run at minimum:

```bash
npm ci
npm run build
npm run lint
npm run verify:text
npm test -- --runInBand
npm run test:integration -- --runInBand
```

If Docker/Testcontainers is unavailable, report that as an environment block rather than a green verdict.

## Verdict

Rate the work for TD-3 on a 1-10 scale. Give a verdict pending green CI. List blockers, High/Medium/Low findings, and any remaining TD-5 work.
