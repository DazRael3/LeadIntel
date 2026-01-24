## Launch Readiness Report (Vercel + Supabase + Stripe + Resend + Upstash + Clearbit + Zapier)

Date: 2026-01-22  
Branch: `cursor/initial-repository-read-6c5a`

---

### What changed in this session (high level)

- **Docs sweep + reconciliation**
  - Updated launch and ops docs to be consistent, removed stale env “file-by-file status”, and added explicit staging smoke checks.

- **DB + migrations readiness**
  - Added `0015_api_grants_for_tracking_and_feature_flags.sql` to ensure authenticated role has explicit table privileges for tenant-scoped tables used by the app.
  - Added an **optional** automated RLS sanity script (`scripts/db-sanity-rls.ts`) for staging/prod verification.

- **Cron/digest correctness**
  - Fixed `/api/digest/run` to operate in cron/system mode using **service role** (cross-tenant by design).
  - Removed double body parsing so it works correctly behind `withApiGuard`.

- **Security posture hardening**
  - Brought several critical routes under `withApiGuard` so policy-enforced origin checks, rate limits, payload caps, and standardized envelopes apply consistently.
  - Removed unsafe raw-provider logging in `lib/ai-logic.ts` (no raw OpenAI response logging).

---

### Verified & green

- **Lint**: `npm run lint` ✅
- **Unit tests**: `npm run test:unit` ✅
- **E2E tests**: `npm run test:e2e` ✅
- **Pre-launch gate**: `npm run verify:ready` ✅

---

### Migrations / DB readiness

Recommended production migration set is documented in `docs/LAUNCH_CHECKLIST.md`, and includes:

- Base + app alignment:
  - `0001_init_api_schema.sql`
  - `0004_missing_tables.sql`
  - `0008_align_schema_with_app.sql`
- Phase-1 launch features:
  - `0010_tracking_keys_and_email_logs.sql`
  - `0011_engagement_tracking.sql`
  - `0012_conversion_tracking.sql`
  - `0013_autopilot_enabled.sql`
  - `0014_feature_flags.sql`
  - `0015_api_grants_for_tracking_and_feature_flags.sql`

DB verification steps:
- SQL checks in `docs/ANALYTICS_RLS.md`
- Optional script: `RUN_DB_SANITY=1 npm run db:sanity` (requires real Supabase creds; not run in CI)

---

### Cron, autopilot, digest, discover

- Cron auth supports:
  - Signed `cron_token` (preferred, bound to method+path via `CRON_SIGNING_SECRET`)
  - Legacy `X-CRON-SECRET` (fallback)
- Autopilot cron safety:
  - Only processes tenants with `api.user_settings.autopilot_enabled = true`
  - Global kill switch `FEATURE_AUTOPILOT_ENABLED` hard-disables sending
- Digest:
  - Uses service role (cross-tenant) for cron/admin runs
  - Manual/admin path requires `x-admin-digest-secret`
- Discover:
  - Placeholder, but cron auth + rate limits are enforced

---

### Webhooks (security + kill-switch semantics)

- **Resend webhook**:
  - Raw-body signature verification with `RESEND_WEBHOOK_SECRET`
  - Kill switch: `FEATURE_RESEND_WEBHOOK_ENABLED=0` ⇒ verify signature but ACK early (no DB writes)

- **Stripe webhook**:
  - Signature verified by guard
  - Kill switch: `FEATURE_STRIPE_WEBHOOK_ENABLED=0` ⇒ ACK early (no business updates)

---

### Feature flags / staged rollout

- Global kill switches (`FEATURE_*`) remain the emergency “hard OFF” layer.
- Per-tenant overrides live in `api.feature_flags` (RLS enforced) and are managed via `POST /api/settings/features`.
  - Currently supported per-tenant keys: `clearbit_enrichment`, `zapier_push`

---

### Observability + metrics

- Sentry: enabled via `SENTRY_DSN` (+ optional `SENTRY_ENVIRONMENT`), no-op when unset.
- Health endpoint: `GET /api/health` (unauthenticated + rate-limited).
- Metrics facade emits safe breadcrumbs/logs for key events (autopilot, webhooks, send pitch, ratelimit blocks).

---

### Remaining known risks / manual operator steps

- **Apply migrations in Supabase** and reload PostgREST schema cache if needed.
- **Configure required env vars in Vercel** (Supabase/Stripe/Resend/OpenAI/Upstash plus cron tokens/secrets).
- **Run staging smoke checks** listed in `docs/LAUNCH_CHECKLIST.md`.
- **External provider behavior** (Clearbit/Zapier) should be staged using:
  - Global kill switches + per-tenant overrides, and monitored via Sentry + logs.

