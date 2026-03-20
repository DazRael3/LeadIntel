# Email automation (Resend + cron)

LeadIntel’s launch automation is intentionally **small and production-safe**:
- it sends a few lifecycle emails tied to real product behavior
- it runs from a cron-triggered job endpoint
- it is **idempotent** (deduped) and safe to rerun
- it does **not** add a marketing automation platform

## Architecture

- **Lifecycle state**: `api.lifecycle_state`
  - Stores one-time “sent_at” markers for lifecycle emails.
- **Email idempotency log**: `api.email_send_log`
  - Enforces dedupe with a unique `dedupe_key` so cron reruns don’t spam.
- **Provider send log**: `api.email_logs`
  - Records outbound email attempts (provider correlation, status).

## Cron entrypoint

Scheduled jobs are triggered via:
- `GET /api/cron/run?job=...`
- `POST /api/cron/run`

Auth is required via an Authorization bearer token:
- `Authorization: Bearer $CRON_SECRET` (recommended)
- or `Authorization: Bearer $EXTERNAL_CRON_SECRET`

## Jobs

### `job=lifecycle`
Runs lifecycle eligibility checks and sends at most **one email per user per run**, in a fixed priority order.

**Email types**
- **welcome**: after signup/first login (also best-effort via `/api/lifecycle/ensure`)
- **nudge_accounts**: after ~6h if they haven’t added enough accounts
- **nudge_pitch**: after ~24h if they haven’t generated an output yet
- **first_output**: after the first successful pitch/report (only if recent)
- **starter_near_limit**: Starter is approaching the 3-preview cap
- **starter_exhausted**: Starter has reached the 3-preview cap
- **value_recap**: recap + upgrade framing after activation
- **winback**: reactivation nudge after inactivity
- **feedback_request**: one lightweight request after initial usage
- **upgrade_confirmation**: cron backstop if a webhook missed it

### `job=digest_lite` (optional)
Sends the daily digest email only for users who have enabled digest emails in settings.

### `job=kpi_monitor` (optional)
Monitors funnel KPI drops (PostHog) and emails an operator alert if configured.

## Operator notifications (optional)

Operator notifications are delivered via Resend when configured:
- new signup / first login (from `/api/lifecycle/ensure`)
- first output generated (from the lifecycle job when sending `first_output`)
- feedback submitted (from `/api/feedback`)
- upgrade completed (from Stripe webhook)

These are controlled by env and deduped via `api.email_send_log`.

## Environment variables

Required to actually send mail:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Required for cron:
- `CRON_SECRET` (or `EXTERNAL_CRON_SECRET`)

Optional launch controls:
- `LIFECYCLE_EMAILS_ENABLED` (`1|0|true|false`) — kill switch (default enabled)
- `LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED` (`1|0|true|false`) — operator notifications (default enabled)
- `LIFECYCLE_ADMIN_EMAILS` — comma-separated operator recipients
- `FEEDBACK_NOTIFICATION_EMAILS` — optional override recipient list for feedback notifications
- `ADMIN_TOKEN` — required for manual admin send endpoint below

## Manual operator send (support/help)

For a one-off “support help” email, call:
- `POST /api/admin/lifecycle/send`

Headers:
- `x-admin-token: $ADMIN_TOKEN`

Body:

```json
{
  "toEmail": "user@example.com",
  "type": "support_help",
  "userId": "optional-user-uuid"
}
```

This endpoint is deduped by default to **at most once per day** per recipient+type (override with `dedupeKey` if needed).

## Dedupe/idempotency rules

- Cron sends use a stable dedupe key: `lifecycle:<type>:<userId>`
- Operator notifications use `admin:<event>:...`
- Lifecycle `*_sent_at` columns in `api.lifecycle_state` provide a second layer of safety and also make eligibility transparent.

## Safe testing

Run cron job in dry-run mode:

```bash
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/run?job=lifecycle&dryRun=1&limit=50"
```

Run a small real batch (after setting Resend env vars):

```bash
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/run?job=lifecycle&limit=50"
```

