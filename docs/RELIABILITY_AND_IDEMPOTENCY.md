# Reliability and Idempotency

This wave hardens “double click / retry” behavior across core operational flows, without weakening entitlements or logging sensitive payloads.

## Principles

- **Idempotent where retries are common** (exports, report/brief generation).
- **Fail closed on entitlement** (Free vs paid remains enforced).
- **Failures do not consume usage** (Free-tier reservations are cancelled on errors).
- **No sensitive bodies in logs/audit** (metadata only, truncated/sanitized).

## Implemented behavior

### Exports: retry-safe creation

`/api/exports/create` reuses a **recent pending job** for the same workspace + creator + export type (2 minute window).

Outcome:
- repeated clicks and network retries do not create multiple jobs
- audit logs record `export.created` and `export.failed`

### Competitive reports: retry-safe generation

`/api/competitive-report/generate` checks for a report generated in the last 60 seconds for the same `companyKey`.

Outcome:
- avoids duplicate report creation under retries
- avoids double usage counting when a recent report exists

### Account briefs: retry-safe generation

`/api/accounts/[accountId]/brief` reuses a brief generated in the last 60 seconds for the same account + window.

Outcome:
- repeated clicks don’t spam saved briefs

### Webhooks: best-effort enqueue dedupe

`enqueueWebhookEvent()` avoids inserting duplicate `webhook_deliveries` rows if the same `eventId` + `eventType` has already been enqueued for an endpoint.

Callers were updated to use stable `eventId`s where object IDs exist (e.g., report id, export job id, pitch id).

## Notes on usage counting

Premium generation counting is backed by `api.usage_events` reservations:

- Reserve → Complete (counts) or Cancel (does not count).
- Failures cancel the reservation best-effort.
- A uniqueness constraint prevents counting the *same object* twice.

