# Production Observability Setup

This document maps observability and automation-related environment variables used by LeadIntel.
It intentionally avoids printing or storing secret values.

## Environment variable map

| Env var | Required | Where to get it | Safe for `NEXT_PUBLIC_*` | Secret | Used by |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Required in production | Your deployment domain (Vercel project setting) | Yes | No | Canonical URLs, health/version links, redirects |
| `ALLOWED_ORIGINS` | Recommended in production | Your allowed frontend origins list | Yes (already client-safe format) | No | Origin validation for state-changing API routes |
| `CRON_SECRET` | Required when enabled cron jobs are used | Generate random secret in password manager / Vercel env | No | Yes | Vercel/external cron Bearer auth (`/api/cron/run`, `/api/cron/webhooks`) |
| `EXTERNAL_CRON_SECRET` | Optional but recommended for non-Vercel schedulers | Generate random secret in password manager | No | Yes | External scheduler Bearer auth fallback |
| `DIGEST_CRON_SECRET` | Optional app-specific alias | Generate random secret if this route requires a dedicated secret | No | Yes | Digest cron auth (if route-specific auth is enabled) |
| `ACTIONS_QUEUE_CRON_SECRET` | Optional app-specific alias | Generate random secret if queue delivery cron is segmented | No | Yes | Actions queue cron auth (if route-specific auth is enabled) |
| `SITE_REPORT_CRON_SECRET` | Required when `ENABLE_SITE_REPORTS=true` | Generate random secret in password manager | No | Yes | `/api/admin/site-report/run` auth |
| `TRIGGER_EVENTS_CRON_SECRET` | Optional (required only when trigger ingest cron is used) | Generate random secret | No | Yes | `/api/trigger-events/ingest` auth |
| `ENABLE_SITE_REPORTS` | Optional | Feature flag in Vercel env | No | No | Site report automation enable/disable |
| `ADMIN_SECRET` | Optional/internal | Generate random secret | No | Yes | Admin-only internal endpoints when enabled |
| `POSTHOG_PROJECT_ID` | Optional (required only for private PostHog API features) | PostHog project settings numeric ID | No | No | KPI monitor/private PostHog API queries |
| `POSTHOG_PERSONAL_API_KEY` | Optional (required for private PostHog API features) | PostHog personal API keys | No | Yes | Server-side PostHog private API queries |
| `POSTHOG_API_KEY` | Optional alternative to personal key | PostHog service API keys | No | Yes | Server-side PostHog private API fallback key |
| `POSTHOG_PROJECT_API_KEY` | Optional compatibility alias | PostHog project API key | No | Yes | Server-side private API compatibility |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional (capture-only analytics) | PostHog project token (`phc_`/`phx_` style) | Yes | No | Browser/server analytics capture |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional (defaults to PostHog cloud host) | PostHog host URL (origin only) | Yes | No | Analytics client host configuration |
| `SENTRY_DSN` | Optional | Sentry project DSN (server) | No | Sensitive config | Server-side Sentry reporting |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry project DSN (public) | Yes | Sensitive config (public DSN) | Client-side Sentry reporting |
| `SENTRY_ENVIRONMENT` | Optional | Your env naming convention (`production`, `preview`, etc.) | No | No | Sentry event environment tagging |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional | Chosen tracing sampling ratio (0..1) | No | No | Sentry tracing config |
| `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` | Optional | Chosen replay sampling ratio (0..1) | No | No | Sentry replay config |
| `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Optional | Chosen replay-on-error ratio (0..1) | No | No | Sentry replay-on-error config |
| `SENTRY_AUTH_TOKEN` | Optional (build-time sourcemaps) | Sentry auth token | No | Yes | Sentry sourcemap upload in CI/build |
| `SENTRY_ORG` | Optional (build-time sourcemaps) | Sentry organization slug | No | No | Sentry sourcemap upload |
| `SENTRY_PROJECT` | Optional (build-time sourcemaps) | Sentry project slug | No | No | Sentry sourcemap upload |
| `VERCEL_ENV` | Auto-provided by Vercel | Vercel runtime env | N/A | No | Build/version metadata |
| `VERCEL_TARGET_ENV` | Auto-provided by Vercel | Vercel target env | N/A | No | Build/version metadata |
| `VERCEL_GIT_COMMIT_SHA` | Auto-provided by Vercel | Vercel git metadata | N/A | No | Build/version metadata |
| `VERCEL_GIT_COMMIT_REF` | Auto-provided by Vercel | Vercel git metadata | N/A | No | Build/version metadata |
| `VERCEL_GIT_REPO_OWNER` | Auto-provided by Vercel | Vercel git metadata | N/A | No | Build/version metadata |
| `VERCEL_GIT_REPO_SLUG` | Auto-provided by Vercel | Vercel git metadata | N/A | No | Build/version metadata |
| `VERCEL_GIT_PROVIDER` | Auto-provided by Vercel | Vercel git metadata | N/A | No | Build/version metadata |
| `COMMIT_SHA` | Optional fallback | CI pipeline env | N/A | No | Build/version metadata fallback |
| `NEXT_PUBLIC_GIT_COMMIT_SHA` | Optional fallback | CI/public metadata injection | Yes | No | Build/version metadata fallback |

## PostHog key usage guardrails

- `NEXT_PUBLIC_POSTHOG_KEY` may be a `phc_`/`phx_` token.
- `POSTHOG_PROJECT_ID` must be numeric if private PostHog API features are enabled.
- Do **not** place `phc_` or `phx_` tokens in `POSTHOG_PROJECT_ID`.

## Sentry guardrails

- Missing Sentry DSN must never crash routes.
- Keep `SENTRY_AUTH_TOKEN` server/build only.
- Never expose secrets in status, health, or version responses.

### If `@sentry/nextjs` is not installed

Install Sentry SDK only when you intentionally want Sentry runtime instrumentation:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

If DSN env vars are set but the SDK package is absent, diagnostics will report this as a safe misconfiguration.

## Automation guardrails

- Missing cron config may degrade automation status, but must not break signup, auth, checkout, billing, or public pages.
- Disabled optional automation should report disabled, not degraded.
