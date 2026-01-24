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
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

- **Stripe**
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_PRICE_ID` (or `STRIPE_PRICE_ID_PRO`)

- **Resend**
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `RESEND_WEBHOOK_SECRET`

- **OpenAI**
  - `OPENAI_API_KEY`

- **Clearbit (optional)**
  - `CLEARBIT_REVEAL_API_KEY` (Ghost Reveal)
  - `CLEARBIT_API_KEY` (optional enrichment)

- **Zapier (optional)**
  - `ZAPIER_WEBHOOK_URL`

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

- `0001_init_api_schema.sql` (base `api.*` tables + RLS + grants)
- `0004_missing_tables.sql` (website visitors, email logs, etc.)
- `0008_align_schema_with_app.sql` (adds columns app expects)
- `0010_tracking_keys_and_email_logs.sql`
- `0011_engagement_tracking.sql`
- `0012_conversion_tracking.sql`
- `0013_autopilot_enabled.sql`
- `0014_feature_flags.sql` (per-tenant feature overrides)
- `0015_api_grants_for_tracking_and_feature_flags.sql` (explicit GRANTs for authenticated on new tables)

Notes:
- Analytics + email logging assume schema `api` and RLS policies are enabled.
- After applying migrations, reload PostgREST schema cache if needed.
 - After applying `0015`, authenticated app routes should no longer hit "permission denied" on `api.website_visitors`, `api.email_logs`, or `api.feature_flags`.

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
 - `npm run verify:ready` (shortcut)

Verify:
- `/api/health` returns `ok: true` and `data.status !== "down"` in your environment.
- Cron invocations succeed with signed `cron_token`.
- Webhooks validate signatures and respect kill switches.
 - RLS sanity: run the SQL checks in `docs/ANALYTICS_RLS.md` after migrations to confirm RLS + grants.
 - (optional) Run the automated RLS sanity script (staging/prod): `RUN_DB_SANITY=1 npm run db:sanity`

---

### 7) Manual smoke checks (staging)

- **Auth + dashboard**
  - Login works and dashboard loads.
  - Settings tab loads and autopilot toggle can be flipped.

- **Core product**
  - Generate pitch (`/api/generate-pitch`) succeeds for an authenticated user.
  - Generate sequence (`/api/generate-sequence`) succeeds for Pro user.
  - Send pitch (`/api/send-pitch`) succeeds for Pro user and writes an email log.

- **Tracking / reveal**
  - Tracker script (`GET /api/tracker?k=...`) loads.
  - Tracker POST writes `api.website_visitors` rows (verify in Supabase).
  - Reveal (`POST /api/reveal`) respects global + per-tenant flags.

- **Payments**
  - Upgrade flow calls `POST /api/checkout` and returns a Stripe checkout URL.
  - Portal flow calls `POST /api/stripe/portal` and returns a portal URL.

- **Integrations**
  - Push to CRM (`POST /api/push-to-crm`) respects global + per-tenant flags.


---

### Scratch (repo/docs sweep findings — to reconcile before launch)

This section is intentionally “internal notes” from a repo sweep. It should be burned down as part of launch hardening.

- **ENV checklist is partially stale**
  - `docs/ENV_VARIABLES_CHECKLIST.md` includes a “File-by-File Usage” section that flags many routes as “still uses process.env.*”.
  - The codebase has since moved many critical paths to `serverEnv`/`clientEnv` and added new runtime controls (kill switches, per-tenant overrides, health checks).
  - Action: refresh that section or remove the per-file audit in favor of `lib/env.ts` being the source of truth.

- **Launch checklist is missing some required/operational envs**
  - Action: ensure the top-level list includes:
    - Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (required in production for rate limiting)
    - OpenAI: `OPENAI_API_KEY` (required for AI routes)
    - Clearbit: `CLEARBIT_REVEAL_API_KEY` / `CLEARBIT_API_KEY` (if enabling enrichment)
    - Zapier: `ZAPIER_WEBHOOK_URL` (if enabling CRM push)
    - Digest: `ADMIN_DIGEST_SECRET` (if using non-cron admin path)

- **DB verification steps need to be consolidated**
  - `docs/ANALYTICS_RLS.md` has SQL checks for analytics tables; the launch checklist needs a single “DB verification steps” section that also covers:
    - `api.website_visitors`
    - `api.email_logs`
    - `api.feature_flags`


