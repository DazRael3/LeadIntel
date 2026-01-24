## Operations Runbook (minimal)

This is a small, practical guide for operating LeadIntel in production.

> Local dev uses `.env.local`.

---

### 1) Uptime monitoring

- **Endpoint**: `GET /api/health`
- **Expected**: `ok: true` and `data.status` in `"ok" | "degraded" | "down"`

Recommended checks:
- Alert immediately on `"down"`.
- Alert if `"degraded"` persists (e.g. > 10 minutes).

Notes:
- In production, external providers are typically reported as “configured (not actively checked)” unless `HEALTH_CHECK_EXTERNAL=1`.

---

### 2) Error tracking (Sentry)

Enable Sentry by setting:
- `SENTRY_DSN`
- (optional) `SENTRY_ENVIRONMENT`

Privacy/security:
- We intentionally avoid sending raw request bodies, webhook payloads, tokens, secrets, or full email bodies as context.

---

### 3) Kill switches (global feature flags)

During an incident, you can disable specific high-risk subsystems without redeploying code (env flip + redeploy of env is still required in many platforms).

Kill switch env vars:
- `FEATURE_AUTOPILOT_ENABLED`: disables `/api/autopilot/run` email sending job
- `FEATURE_RESEND_WEBHOOK_ENABLED`: webhook still verifies signature but **ACKs early** (no DB writes)
- `FEATURE_STRIPE_WEBHOOK_ENABLED`: webhook still verifies signature but **ACKs early** (no subscription updates)
- `FEATURE_CLEARBIT_ENABLED`: disables Clearbit reveal/enrichment
- `FEATURE_ZAPIER_PUSH_ENABLED`: disables Zapier push to CRM

Values:
- Disable: `0` or `false`
- Enable: `1` or `true`

Operational guidance:
- Prefer disabling **the smallest surface area** first (e.g. `FEATURE_RESEND_WEBHOOK_ENABLED=0` rather than disabling all traffic).
- Re-enable gradually and watch Sentry + logs.

### 3b) Per-tenant feature overrides

If global kill switches allow a feature, per-tenant overrides can still enable/disable for individual tenants.

- Backing table: `api.feature_flags` (tenant-scoped via RLS)
- Update API: `POST /api/settings/features`
- Supported keys today:
  - `clearbit_enrichment`
  - `zapier_push`

---

### 4) Minimal metrics (today)

Metrics are currently emitted as:
- **Sentry breadcrumbs** (when `SENTRY_DSN` is set), or
- **structured console logs** with prefix `[metric]` (when Sentry is disabled).

Key metric names to watch:
- `autopilot.run.total`, `autopilot.run.error`
- `webhook.resend.total`, `webhook.resend.error`, `webhook.resend.signature_invalid`
- `webhook.stripe.total`, `webhook.stripe.error`
- `send_pitch.success`, `send_pitch.error`
- `ratelimit.block`

Future upgrade path:
- Swap `lib/observability/metrics.ts` implementation to a real metrics backend (Prometheus/OTel/Datadog/etc.) without changing call sites.

