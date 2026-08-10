# Independent Review Prompt — WhatsApp Outbound TD-3 Round 2

You are a senior backend engineer performing a focused follow-up review of the KasiCash WhatsApp outbound TD-3 remediation.

Receipt-check the archive and confirm the TD-3 files are present, especially:

- `src/ingestion/whatsapp.client.ts`
- `src/ingestion/ingestion.module.ts`
- `src/ingestion/ingestion.service.ts`
- `src/ingestion/whatsapp.client.spec.ts`
- `src/config/runtime-config.ts`
- `src/config/runtime-config.spec.ts`
- `test/whatsapp-cloud-client.e2e-spec.ts`
- `.env.example`
- `WHATSAPP_OUTBOUND_INTEGRATION_DESIGN.md`
- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- `TECH_DEBT.md`

Round 1 accepted the implementation pending green CI and raised only non-blocking polish:

1. The default Cloud API send timeout was generous at 10 seconds.
2. `providerHttpError` classified the HTTP status twice.

For Round 2, verify the follow-up:

- Default `WHATSAPP_SEND_TIMEOUT_MS` is now 5000 ms in code and documentation, while explicit overrides remain bounded to 1000-30000 ms.
- The timeout change does not alter best-effort semantics: inbound messages are still marked `PROCESSED` before outbound send; send failures still never requeue ingestion, repeat ledger/proposal work, or mutate financial state.
- `providerHttpError` classifies status once and still emits the same retryable/permanent error taxonomy.
- Provider abstraction remains intact: business logic depends on `WhatsAppClient`, not Meta-specific request details.
- Secrets and PII remain absent from thrown/loggable data: no access tokens, phone numbers, message bodies, or raw provider response text.
- CI/tests still use stubs or the local mock HTTP server only and never call Meta.

Run or inspect the relevant tests:

- `npm run build`
- `npm run lint`
- `npm test -- --runInBand src/ingestion/whatsapp.client.spec.ts src/config/runtime-config.spec.ts`
- `npm run test:integration -- --runInBand test/whatsapp-cloud-client.e2e-spec.ts`

Then give findings ordered by severity, rate the work, and state whether TD-3 is accepted pending the repository's full real-PostgreSQL CI/Testcontainers run.
