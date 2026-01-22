## Launch Checklist (Phase-1 → Production)

This checklist is meant to be **actionable** and aligned with the current repo code.
Local development uses `.env.local`.

---

### 1) Environment variables

Use `docs/ENV_VARIABLES_CHECKLIST.md` as the source of truth. At a minimum, ensure:

- **Supabase**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api`

- **Stripe**
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

- **Resend**
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_WEBHOOK_SECRET`

- **Cron (automation endpoints)**
  - `CRON_SIGNING_SECRET`
  - (optional legacy) `CRON_SECRET`
  - `CRON_TOKEN_AUTOPILOT`, `CRON_TOKEN_DISCOVER`, `CRON_TOKEN_DIGEST` (mapped in `vercel.json`)

- **Observability**
  - (optional) `SENTRY_DSN` (empty disables)
  - (optional) `SENTRY_ENVIRONMENT`

- **Kill switches (global)**
  - `FEATURE_AUTOPILOT_ENABLED`
  - `FEATURE_RESEND_WEBHOOK_ENABLED`
  - `FEATURE_STRIPE_WEBHOOK_ENABLED`
  - `FEATURE_CLEARBIT_ENABLED`
  - `FEATURE_ZAPIER_PUSH_ENABLED`

Recommended initial values:
- Start with **features enabled** unless you’re staging rollout:
  - `FEATURE_AUTOPILOT_ENABLED=true`
  - `FEATURE_CLEARBIT_ENABLED=false` (if you want to stage external enrichment)
  - `FEATURE_ZAPIER_PUSH_ENABLED=false` (if you want to stage CRM integrations)

---

### 2) Supabase migrations (required)

Apply migrations in `supabase/migrations/` (idempotent where possible).
Production should include at least:

- `0010_tracking_keys_and_email_logs.sql`
- `0011_engagement_tracking.sql`
- `0012_conversion_tracking.sql`
- `0013_autopilot_enabled.sql`
- `0014_feature_flags.sql` (per-tenant feature overrides)

Notes:
- Analytics + email logging assume schema `api` and RLS policies are enabled.
- After applying migrations, reload PostgREST schema cache if needed.

---

### 3) Cron setup (Vercel)

See `docs/CRON_AND_AUTOPILOT_ROLLOUT.md` for details.

- Ensure `vercel.json` cron entries include `cron_token=...`.
- Generate tokens using `CRON_SIGNING_SECRET` (or precompute and set `CRON_TOKEN_*` env vars).
- Ensure cron endpoints are allowed by policy:
  - `POST /api/autopilot/run`
  - `POST /api/leads/discover`
  - `POST /api/digest/run`

---

### 4) Observability, health, and metrics

- **Health endpoint**: `GET /api/health`
  - Use this for uptime monitors.
  - In production, external providers are not actively checked unless `HEALTH_CHECK_EXTERNAL=1`.

- **Sentry**
  - Set `SENTRY_DSN` to enable.
  - No raw payloads/tokens/email bodies are attached by design.

- **Metrics facade**
  - Implemented in `lib/observability/metrics.ts`.
  - Metrics emit as Sentry breadcrumbs (if enabled) or `[metric]` structured logs.
  - Key metric names:
    - `autopilot.run.total`, `autopilot.run.error`
    - `webhook.resend.total`, `webhook.resend.error`, `webhook.resend.signature_invalid`
    - `webhook.stripe.total`, `webhook.stripe.error`
    - `send_pitch.success`, `send_pitch.error`
    - `ratelimit.block`

---

### 5) Rollout controls (staged enablement)

You have **three layers** of control:

1) **Global kill switches** (`FEATURE_*`)
   - Emergency OFF takes precedence over everything.

2) **Per-tenant overrides** (`api.feature_flags`)
   - Managed via `POST /api/settings/features` for the current authenticated tenant.
   - Currently supports:
     - `clearbit_enrichment`
     - `zapier_push`

3) **Autopilot opt-in**
   - Tenant-scoped: `api.user_settings.autopilot_enabled`
   - Managed via dashboard toggle and `POST /api/settings/autopilot`.

Suggested staged rollout:
- Keep `FEATURE_AUTOPILOT_ENABLED=true` but leave `autopilot_enabled=false` for most tenants.
- Enable `autopilot_enabled=true` for a small cohort.
- Keep `FEATURE_CLEARBIT_ENABLED=true` globally, but disable per-tenant by default and selectively enable via `/api/settings/features`.
- Keep `FEATURE_ZAPIER_PUSH_ENABLED=true` globally, but disable per-tenant by default and selectively enable via `/api/settings/features`.

---

### 6) Pre-launch quality gates

Run:
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`

Verify:
- `/api/health` returns `ok: true` and `data.status !== "down"` in your environment.
- Cron invocations succeed with signed `cron_token`.
- Webhooks validate signatures and respect kill switches.

