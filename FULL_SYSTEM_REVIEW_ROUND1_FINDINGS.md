# KasiCash Full-System Independent Review - Round 1 Findings

Date received: 2026-08-02

This is the finding index from the independent review that rated the submitted
snapshot **3/10 and not production-ready**. The review's detailed evidence was
used to produce `INDEPENDENT_REVIEW_REMEDIATION.md`. A round-two reviewer must
reproduce the attacks and must not accept the remediation table as proof.

## Critical

- **C1:** referenced account `business_id`, `code`, and `type` were mutable, so
  current account metadata could reinterpret historical ledger entries.
- **C2:** database reversal constraints allowed cross-currency and orphan
  reversal states, making currency-filtered reports incorrect.

## High

- **H1:** runtime readiness had no canonical migration catalog, could report a
  worker healthy before a successful cycle, and could throw on dependency
  inspection instead of returning `not_ready`.
- **H2:** ingestion leases had no fencing token, allowing an expired worker to
  overwrite or duplicate the reclaimed worker's outcome.
- **H3:** sender messages and proposal transitions were not serialized, so a
  later confirmation could run before its proposal or race another transition.
- **H4:** an alert could be resent after a crash between provider acceptance and
  persisting `SENT`.
- **H5:** user-agent/account-keyed process-local rate limits were bypassable,
  unbounded, proxy-sensitive, and inconsistent across instances.
- **H6:** financial and operational instants used timezone-ambiguous PostgreSQL
  `timestamp` columns.
- **H7:** arbitrary currencies were accepted while presentation assumed a
  two-decimal scale.
- **H8:** raw provider/database error text could reach logs, persisted error
  fields, readiness, or the authenticated DLQ response.
- **H9:** authenticated malformed webhook deliveries were not durably preserved
  before per-message extraction.
- **H10:** missing WhatsApp production credentials silently selected a logging
  client and discarded replies while reporting success.

## Medium

- Reversal service lookup was not scoped by trusted `businessId`.
- Dashboard date ranges and offsets were unbounded.
- Expired webhook replay records were not refreshed on reuse.
- Shutdown draining began too late in Nest's lifecycle.
- Unknown-principal login skipped password hashing and leaked timing.
- Production permitted insecure auth cookies through configuration.
- Parsed amounts were not checked against PostgreSQL signed-bigint limits.
- The production dependency audit reported high/moderate advisories.

## Low

- Line-ending churn made the review's diff check fail.
- The lint script mutated files, and CI did not assert a clean tree afterward.

## Original Acceptance Gate

The reviewer required new database migrations and real-PostgreSQL adversarial
tests for ledger integrity; fenced ordered ingestion; truthful readiness;
multi-instance rate limiting; explicit time/currency contracts; privacy-safe
telemetry; fail-closed outbound configuration; and a green integration plus
full migration run/revert chain from the committed snapshot.

The original verdict remains historical evidence, not automatically overturned.
Production readiness still requires a green round-two CI run against real
PostgreSQL and an independent review of the remediated snapshot.
