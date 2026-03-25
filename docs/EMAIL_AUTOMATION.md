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

### `job=prospect_watch` (optional)
Runs the **prospect watch** ingestion + scoring + draft generation loop (review-first).

### `job=prospect_watch_digest` (optional)
Sends the daily internal digest for the founder/operator review queues.

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
- `RESEND_REPLY_TO_EMAIL` (recommended; defaults to `leadintel@dazrael.com`)

Required for cron:
- `CRON_SECRET` (or `EXTERNAL_CRON_SECRET`)

Optional launch controls:
- `LIFECYCLE_EMAILS_ENABLED` (`1|0|true|false`) — lifecycle email send enable (default **disabled**)
- `LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED` (`1|0|true|false`) — operator notifications enable (default **disabled**)
- `LIFECYCLE_ADMIN_EMAILS` — comma-separated operator recipients (recommended: `leadintel@dazrael.com`)
- `FEEDBACK_NOTIFICATION_EMAILS` — optional override recipient list for feedback notifications (recommended: `leadintel@dazrael.com`)
- `ADMIN_TOKEN` — required for manual admin send endpoint below

## Production routing (recommended values)

Given your production inbox is `leadintel@dazrael.com` (Namecheap Private Email), the intended routing is:
- **Reply-To**: `RESEND_REPLY_TO_EMAIL="leadintel@dazrael.com"`
- **Operator notifications**: `LIFECYCLE_ADMIN_EMAILS="leadintel@dazrael.com"`
- **Feedback notifications**: `FEEDBACK_NOTIFICATION_EMAILS="leadintel@dazrael.com"` (or omit to fall back to `LIFECYCLE_ADMIN_EMAILS`)

## Migration notes

- `0071_email_automation_launch.sql` drops and recreates `api.lifecycle_batch_context(int)` before changing its return shape.
  - Reason: Postgres cannot `CREATE OR REPLACE` a function when the return type changes.

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

## Email Lab (preview + test-send)

LeadIntel includes an internal-only **Email Lab** so operators can preview and QA templates before broad enablement.

- **UI**: `/admin/email?token=$ADMIN_TOKEN`
- **Linked from**: `/admin/ops?token=$ADMIN_TOKEN`

Capabilities:
- Preview rendered **subject + HTML + plain text**
- Run lightweight **template QA checks** (missing subject/body, missing prefs link, missing support mailto, etc.)
- **Test-send** to operator inboxes only (restricted to env allowlist) with daily dedupe per template+recipient

APIs (admin-token gated):
- `POST /api/admin/email/preview`
- `POST /api/admin/email/test-send`

Test-send recipient safety:
- Allowed recipients come from the operator allowlist:
  - `PROSPECT_WATCH_REVIEW_EMAILS`, `LIFECYCLE_ADMIN_EMAILS`, `FEEDBACK_NOTIFICATION_EMAILS`
- If the allowlist is set, `toEmail` must be in it (external addresses are rejected).
 
Analytics (optional; best-effort):
- `POST /api/analytics/track` records:
  - `email_lab_previewed`
  - `email_lab_test_send_clicked`
  - `email_lab_test_send_result`

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

## Production cron schedule (recommended)

Infrastructure reality:
- **1 Vercel cron** available
- **4 external cron jobs** available

Recommended split:
- **Vercel cron (daily backstop)**: lifecycle
  - `GET /api/cron/run?job=lifecycle&limit=200`

- **External cron (twice daily)**:
  - morning: `job=prospect_watch` + `job=prospect_watch_digest`
  - afternoon: `job=prospect_watch` + `job=prospect_watch_digest`

Example request:

```bash
curl -sS \
  -H "Authorization: Bearer $EXTERNAL_CRON_SECRET" \
  "https://dazrael.com/api/cron/run?job=prospect_watch&limit=50"
```

