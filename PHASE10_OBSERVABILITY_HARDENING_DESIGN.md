# Phase 10 Observability And Hardening Design

Phase 10 makes KasiCash operable without changing financial behavior. It adds
signals around the existing ledger, ingestion, auth, reports, analytics,
dashboard, and recovery paths. It does not modify ledger invariants, posting
rules, confirmation flow, AI boundaries, money math, tenant authorization, or
idempotency semantics.

## Telemetry Rules

Telemetry is sanitized by default:

- never log passwords, bearer tokens, cookies, webhook signatures, app secrets,
  raw payloads, raw message text, WhatsApp phone numbers, email addresses, or
  private financial content
- do not log money values such as `amountMinor`, formatted money strings, or
  financial figure fields
- hash operational identifiers when they help correlate events without exposing
  raw tenant/user/contact values
- bound free-form error messages before logging

Structured telemetry events are JSON strings with:

```text
level
event
timestamp
correlation_id
fields
```

The event name is low-cardinality. Labels and metric dimensions are
allowlisted/sanitized.

## Correlation ID Propagation

HTTP requests pass through `CorrelationMiddleware`:

- accepts a safe `x-request-id` header when present
- otherwise generates `req_<random>`
- writes `x-request-id` on the response
- stores the ID in `AsyncLocalStorage`

Request metrics and structured logs read the active correlation ID. Webhook
async processing inherits the request context through the existing async
handoff. Recovery cycles create their own operational events when no HTTP
context exists.

## Metrics

Metrics are in-process and exposed as Prometheus-style text at `GET /metrics`.
This is intentionally simple for Phase 10; durable aggregation and dashboards
are deferred.

Counters:

- `kasicash_http_requests_total{method,route,status}`: traffic and failure rate
- `kasicash_ingestion_webhook_messages_total{result}`: stored vs duplicate
  webhook messages
- `kasicash_ingestion_processing_total{result}`: processed, skipped, or failed
  inbound processing outcomes
- `kasicash_recovery_cycles_total{result}`: successful or failed recovery scans
- `kasicash_auth_failures_total{reason}`: login/session failure pressure without
  identities

Observations:

- `kasicash_http_request_duration_ms{method,route}`
- `kasicash_report_latency_ms{report}`

Gauges:

- `kasicash_recovery_queue_depth{status}` for `RECEIVED`, `FAILED`,
  `PROCESSING`, and `DEAD`
- `kasicash_recovery_worker_up`
- `kasicash_shutdown_draining`

Metrics avoid business IDs, account IDs, phone numbers, message text, and money.

## Health And Readiness

`GET /health` is a liveness check. It reports whether the app process is up and
whether graceful shutdown has started.

`GET /ready` is stricter and returns HTTP 503 when the service must not receive
traffic:

- database query `SELECT 1` must succeed
- no pending TypeORM migrations may exist
- recovery worker must be enabled and live
- graceful shutdown must not be draining

The readiness response also includes recovery queue counts, including DEAD
messages, so operators can see degraded ingestion state without pretending the
DLQ is empty.

## Dead Letter Surface

`GET /ops/dead-letter` is protected by Phase 9 `AuthGuard` and scoped to the
authenticated principal's `business_id`. It returns only operational metadata:

- inbound ID
- attempts
- received/processed/retry timestamps
- bounded sanitized error text

It never returns raw payload, text body, phone number, or money.

Replay remains an operator runbook action in Phase 10 rather than a new product
endpoint. That avoids adding a broad mutation surface in the final hardening
phase.

## Graceful Shutdown

`GracefulShutdownService` coordinates shutdown:

- marks the process as draining
- prevents new ingestion claims from starting once draining begins
- tracks in-flight message processing
- waits up to a bounded timeout for tracked work to finish

This respects the existing atomic claim. If a process is already processing a
message, it can finish. If shutdown begins before a claim, the row remains in
`RECEIVED`/`FAILED` and the recovery worker can pick it up later. If the process
crashes mid-claim, the existing lease expiry makes the row reclaimable.

## Deferred

- OpenTelemetry/exported distributed tracing backend
- hosted metrics dashboards and alerting rules
- log aggregation and retention policy
- formal SLOs/error budgets
- load testing and capacity planning
- distributed rate limits and multi-instance metric aggregation
