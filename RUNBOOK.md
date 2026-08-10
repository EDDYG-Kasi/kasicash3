# KasiCash Production Runbook

This runbook covers the Phase 10 operating signals. It does not change any
financial behavior: the ledger remains immutable, writes still use the existing
confirm-then-post flow, and recovery relies on durable inbound-message state plus
atomic claims.

## Healthy System

- `GET /health` returns `{ ok: true, status: "live" }`.
- `GET /ready` returns HTTP 200 with `database`, `migrations`, `recovery`, and
  `shutdown` all `ok: true`.
- `/ready.recoveryQueue.DEAD` is normally `0`. A non-zero value means messages
  are preserved but require operator attention.
- `/metrics` shows request, ingestion, recovery, report latency, auth failure,
  queue-depth, and shutdown metrics with no tenant IDs, private content, or money
  values.

## Unhealthy Signals

- `/ready` HTTP 503 with `database.ok=false`: database connectivity is broken or
  credentials/networking are wrong.
- `/ready` HTTP 503 with `migrations.ok=false`: migrations are pending; do not
  serve traffic until the migration state is reconciled.
- `/ready` HTTP 503 with `recovery.ok=false`: the recovery worker is disabled,
  has not completed a successful cycle, or its last success is stale, so
  stranded inbound messages may not be retried.
- `/ready` HTTP 503 with `recoveryQueue.ok=false`: queue state could not be read;
  treat this as a dependency failure rather than assuming an empty queue.
- `/health.status="draining"` or `/ready.checks.shutdown.ok=false`: the process
  is shutting down and should not receive new traffic.
- `kasicash_recovery_queue_depth{status="DEAD"} > 0`: at least one message
  exhausted retries and is preserved for manual review.
- Rising `kasicash_auth_failures_total`: credential or token failures increased.
  Investigate without logging or exporting raw credentials.

## Inspect Dead Letters

Use an authenticated Phase 9 session for the affected business:

```bash
curl -H "Authorization: Bearer $KASICASH_SESSION" \
  "https://<host>/ops/dead-letter?limit=50"
```

The response intentionally contains only metadata: inbound ID, status, attempts,
timestamps, and a bounded error code. It never returns raw payload, WhatsApp
text, phone numbers, or money values.

## Inspect Authenticated Webhook Quarantine

`webhook_deliveries` preserves the exact raw bytes of HMAC-authenticated
deliveries. `QUARANTINED` means the signature was valid but one or more message
objects were malformed and therefore were not handed to financial parsing.

```sql
SELECT id, payload_hash, status, error_code, message_count, received_at
  FROM webhook_deliveries
 WHERE status = 'QUARANTINED'
 ORDER BY received_at ASC;
```

Do not print `raw_body` into logs or tickets. Inspect it only in a controlled
operator environment, and never edit it in place. Automated quarantine replay
is deferred until an audited RBAC workflow exists.

## Replay Dead Letters

Replay is deliberately not a public dashboard/API action in Phase 10. Use it
only after the root cause is fixed and the message has been reviewed. Do not edit
the payload, text, business ID, WhatsApp ID, or payload hash.

Controlled one-row requeue:

```sql
BEGIN;

UPDATE inbound_messages
   SET status = 'FAILED',
       attempts = 0,
       error = NULL,
       error_code = NULL,
       claim_token = NULL,
       lease_expires_at = NULL,
       next_retry_at = now()
 WHERE id = '<inbound-id>'
   AND business_id = '<business-id>'
   AND status = 'DEAD';

COMMIT;
```

The recovery worker will pick up the row. Existing idempotency keys, proposal
uniqueness, and ledger constraints still protect against duplicate financial
effects. If a row was already processed or belongs to another business, the
`WHERE` clause updates zero rows.

## Graceful Shutdown

On shutdown the process:

1. marks itself draining;
2. stops starting new ingestion claims;
3. waits for in-flight `processMessage` work to finish for a bounded time;
4. relies on existing lease expiry/recovery for any crashed in-flight claim.

Do not force-kill repeatedly unless necessary. If a force kill happens, inspect
`PROCESSING` rows whose `lease_expires_at` has elapsed; recovery should reclaim
them with a new fencing token. A late owner cannot finalize, fail, heartbeat, or
send a reply after another worker has reclaimed the row.

## Alert Delivery Uncertainty

An alert whose external send began but did not complete cleanly is marked
`DELIVERY_UNCERTAIN`. It is intentionally not retried automatically because the
provider may already have accepted the first send. Reconcile it against provider
delivery records; do not reset it to `FAILED` without an operator decision.

## Production Startup Checks

- Run the full migration catalog before starting application traffic.
- PostgreSQL is the only application database. `KASICASH_DB_MODE=memory` and
  unknown database modes are rejected before Nest or TypeORM initialization.
- Production must set `KASICASH_WHATSAPP_MODE=cloud` plus the access token,
  phone-number ID, app secret, and verify token. Missing values stop startup.
- Production rejects `KASICASH_DEV_TOOLS=true`, and the development controller
  is omitted from the production module graph.
- Production rejects `KASICASH_AUTH_COOKIE_SECURE=false`.
- Keep `KASICASH_TRUST_PROXY_HOPS` at `0` unless a known proxy topology requires
  a bounded value from `1` to `3`.
- `npm audit --audit-level=moderate` must pass in CI.

## Safe Telemetry Handling

Logs and metrics must not contain secrets, webhook signatures, session tokens,
raw payloads, message text, phone numbers, email addresses, money values, or
formatted financial figures. Treat any violation as a security incident and
rotate exposed credentials if needed.
