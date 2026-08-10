# WhatsApp Outbound Cloud API Integration Design

## Scope

This closes TD-3: KasiCash now has an exercised, test-covered Cloud API send path behind the existing provider-agnostic `WhatsAppClient` interface. It does not add ledger writes, does not change inbound idempotency, and does not retry best-effort replies into loops.

Delivery-status callback persistence remains deferred as TD-5. The current webhook path still accepts status-only callbacks, validates the envelope, and skips them without mutating financial state.

## Provider Contract

KasiCash sends text replies with:

```text
POST https://graph.facebook.com/{WHATSAPP_GRAPH_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
Content-Type: application/json
```

The body is:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "27831234567",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Recorded a sale of R30.00."
  }
}
```

The accepted response must contain a `messages[0].id` prefixed with `wamid.`. The client treats a 2xx response without that identifier as a permanent provider protocol failure. It does not persist the provider message id yet; that belongs with TD-5.

`WHATSAPP_GRAPH_API_VERSION` is pinned and defaults to `v24.0`. Meta Graph versions rotate, so upgrades must be explicit: change the env value, run the mock CI tests, run the manual sandbox verification below, then commit the version bump with evidence.

References used for the contract:

- Meta WhatsApp Cloud API Postman collection: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- Meta send text message request: https://www.postman.com/meta/whatsapp-business-platform/request/8gvd47s/send-text-message
- Meta webhook payload reference: https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference

## Error Taxonomy

`CloudApiWhatsAppClient.sendText()` resolves only after the provider accepts the message. It throws `WhatsAppDeliveryError` on failure:

| Class                                  | Codes                                                      | Retryable? | Notes                                                              |
| -------------------------------------- | ---------------------------------------------------------- | ---------: | ------------------------------------------------------------------ |
| Local validation                       | `WHATSAPP_INVALID_RECIPIENT`, `WHATSAPP_INVALID_TEXT_BODY` |         No | No provider call is made.                                          |
| Transport                              | `WHATSAPP_SEND_TIMEOUT`, `WHATSAPP_NETWORK_ERROR`          |        Yes | Timeout is bounded by `WHATSAPP_SEND_TIMEOUT_MS` (1000-30000 ms).  |
| Provider 408/409/425/429/5xx           | `WHATSAPP_PROVIDER_RETRYABLE_FAILURE`                      |        Yes | The caller still does not retry best-effort replies automatically. |
| Provider 4xx except retryable statuses | `WHATSAPP_PROVIDER_PERMANENT_FAILURE`                      |         No | Sanitized status/type/code only.                                   |
| Malformed success body                 | `WHATSAPP_PROVIDER_MALFORMED_SUCCESS`                      |         No | 2xx without a `wamid.` accepted id.                                |

The error message is always generic. Provider body text, tokens, phone numbers, and message bodies are never copied into logs or thrown messages. Only bounded low-cardinality values (`statusCode`, provider `code`, provider `type`) are exposed through `toLogFields()`.

## Best-Effort Mapping

Inbound processing still finalizes the inbound row as `PROCESSED` before sending a reply. If `sendText()` throws:

- the message is not moved back to `FAILED`;
- the recovery worker does not retry the inbound message;
- no ledger or proposal work is repeated;
- ingestion logs only `inbound_id` and the sanitized error code.

This preserves the existing constitutional rule: outbound is a side effect, never the source of financial truth.

Anomaly alert dispatch continues to use the same `WhatsAppClient` abstraction. Existing alert delivery state (`SENT`, `FAILED`, `DELIVERY_UNCERTAIN`) remains non-financial metadata.

## Config And Secrets

Required in cloud mode:

- `KASICASH_WHATSAPP_MODE=cloud`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_GRAPH_API_VERSION` (optional, defaults to `v24.0`)
- `WHATSAPP_SEND_TIMEOUT_MS` (optional, defaults to `5000`)

Production startup rejects non-cloud WhatsApp mode and incomplete credentials. The Cloud client also rejects malformed Graph versions, non-numeric phone-number ids, and out-of-range timeouts.

No token, phone number, or message body is logged by the logging fallback or Cloud client.

## CI And Mock Integration

CI must never call Meta. Unit tests stub `fetch`; `test/whatsapp-cloud-client.e2e-spec.ts` starts a local HTTP server and points `CloudApiWhatsAppClient` at `http://127.0.0.1:{port}` through constructor-only test options. The application factory does not expose a production env knob for a non-Meta base URL.

## Manual Sandbox Verification

Do this only with a Meta sandbox/test number and throwaway text:

1. In Meta for Developers, create or select a WhatsApp Business test app.
2. Add only the intended recipient test number to the sandbox allowlist.
3. Put secrets in local environment or a secret manager, not in git:

```bash
KASICASH_WHATSAPP_MODE=cloud
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_GRAPH_API_VERSION=v24.0
WHATSAPP_SEND_TIMEOUT_MS=5000
```

4. Start the API against a local/staging Postgres database with migrations applied.
5. Send one synthetic dev message only in non-production:

```bash
curl -X POST http://127.0.0.1:3000/dev/whatsapp/text \
  -H "Content-Type: application/json" \
  -H "x-kasicash-dev-token: replace-with-local-token" \
  -d '{"from":"27831234567","text":"hello"}'
```

6. Confirm the test WhatsApp device receives exactly one reply.
7. Confirm logs contain no token, full phone number, or message text.
8. Re-run the same `messageId` once and confirm inbound idempotency prevents another processing/send.

Do not run this in CI. Do not use a production customer number for the first verification.

## TD-5 Deferred

Status callbacks (`sent`, `delivered`, `read`, `failed`) should be persisted only after an `outbound_messages` table exists to store provider `wamid` values and correlate callbacks to one outbound attempt. That migration and reconciliation flow are deferred to TD-5 so this TD-3 slice does not add a half-coupled status store.
