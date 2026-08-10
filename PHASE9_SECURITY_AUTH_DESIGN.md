# Phase 9 Security And Auth Design

Phase 9 replaces the Phase 8 dashboard tenant stub with authenticated,
server-side authorization. It hardens existing HTTP surfaces without changing
ledger immutability, WhatsApp confirm-then-post, AI boundaries, report math,
analytics math, anomaly rules, or bigint money handling.

## Authentication Mechanism

KasiCash uses opaque server-side sessions:

- Users authenticate with email and password at `POST /auth/login`.
- Passwords are stored as `scrypt` hashes with per-password random salt.
- Login returns a high-entropy random session token and sets it as an HttpOnly,
  SameSite cookie. API clients may also send `Authorization: Bearer <token>`.
- Only a SHA-256 hash of the session token is stored in `auth_sessions`.
- Sessions have an explicit expiry, can be revoked at logout, and can be
  rotated by issuing a new session and revoking the old one.

This is intentionally boring and revocable. It avoids self-contained JWT claims
that could outlive authorization changes, and it keeps tenant identity on the
server.

## Principal To Business Model

`auth_principals` ties each dashboard/API principal to exactly one business:

```text
auth_principals.id
auth_principals.business_id -> businesses.id
auth_principals.email_normalized UNIQUE
auth_principals.password_hash
auth_principals.status = ACTIVE | DISABLED
auth_principals.default_currency
auth_principals.timezone
```

There is no client-supplied business selector. `AuthGuard` validates a session
token, loads the principal row, and attaches:

```ts
{
  principalId,
  email,
  businessId,
  currency,
  timezone
}
```

Every protected controller uses that server-side context.

## Phase 8 Tenant Stub Replacement

Phase 8 used `KASICASH_DASHBOARD_BUSINESS_ID`. Phase 9 removes that as the
dashboard authority. `/dashboard/*` now requires `AuthGuard`, and
`DashboardTenantGuard` maps the authenticated principal context into the
dashboard tenant DTO:

```text
authBoundary = PHASE_9_AUTHENTICATED_PRINCIPAL
productionReady = true
```

Client query parameters named `businessId`, `currency`, or `timezone` are
ignored. Report routes also use `AuthGuard` and derive tenant, currency, and
timezone from the principal, not from query strings.

## Session Lifecycle

- Default session TTL: `KASICASH_AUTH_SESSION_TTL_MINUTES` or 480 minutes.
- Login creates a new `auth_sessions` row with token hash and expiry.
- Logout marks the current session revoked and clears the browser cookie.
- Expired, revoked, missing, malformed, and unknown tokens are rejected with a
  generic `401 Unauthorized`.
- Credentials and session tokens are never logged.
- Session cookies default to Secure; local development may set
  `KASICASH_AUTH_COOKIE_SECURE=false`.

## Webhook Hardening

Existing WhatsApp HMAC verification remains mandatory and still uses raw bytes.
Phase 9 adds:

- Rate limiting for webhook verification and delivery endpoints.
- Raw-body size limit before ingestion.
- Replay marker table keyed by payload hash. The controller records a payload
  only after `IngestionService.ingestWebhook()` succeeds. Later duplicates
  within the replay TTL are acknowledged as `EVENT_RECEIVED` without re-running
  ingestion. If ingest fails, no replay marker is written, so Meta retries can
  still persist the inbound message.

This preserves the ack-first, idempotent path: successful first deliveries are
stored before replay suppression begins; failed attempts remain retryable.

## Public/API Rate Limiting

Production uses atomic, hashed, expiring fixed-window counters in PostgreSQL so
limits apply across application instances. Login applies independent IP and
normalized-account buckets. The webhook verifies the raw-body HMAC and size
before charging the shared verified-webhook bucket; invalid signatures use a
separate IP bucket. A hashed, expiring, cardinality-bounded in-memory fallback
is development-only.

The limiter protects:

- `POST /auth/login`
- `POST /webhooks/whatsapp`
- `GET /webhooks/whatsapp`
- dev-tool simulation endpoint when enabled

PostgreSQL contention is monitored as an operational tradeoff. Redis or another
external limiter is deferred until load evidence justifies it; correctness does
not rely on process-local counters in production.

## Threat Model

| Threat | Mitigation |
|---|---|
| Cross-tenant dashboard/report reads | `AuthGuard` loads one principal-bound `business_id`; controllers ignore client tenant fields. Tests manipulate ids and verify the principal tenant wins. |
| Stolen/self-forged tenant claims | Sessions are opaque; tenant id is loaded from Postgres, not from token claims. |
| Password database leak | Passwords are salted `scrypt` hashes; raw passwords are never stored. |
| Token database leak | Only SHA-256 token hashes are stored; bearer token material is not in the database. |
| Expired/revoked token reuse | Guard rejects expired or revoked sessions. |
| Brute-force login | Login endpoint rate limiting plus generic auth failures. |
| Secret leakage in logs | Auth and webhook failures use generic messages and do not log tokens/passwords/signatures. |
| Webhook forgery | Existing raw-body HMAC verification remains required. |
| Webhook replay | Successful payload hashes are recorded and duplicate accepted deliveries are acknowledged without re-ingest. |
| Webhook flood | Public webhook endpoints are rate limited and raw body size is bounded. |
| Ledger/auth coupling regression | Auth adds metadata tables only and does not modify ledger migrations, ledger service, confirm flow, AI resolvers, money math, or read-service SQL. |

## Deferred

- MFA and account recovery.
- RBAC roles and multiple principals per business with granular permissions.
- Audit logging for auth/security events.
- Centralized key management and secret rotation workflows.
- Distributed rate limiting for multi-instance deployments.
- Penetration testing and formal security review.
