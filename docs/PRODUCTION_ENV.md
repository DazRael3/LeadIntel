# Production Environment Checklist (Vercel + Supabase + Stripe)

This document lists the **minimum required** environment variables for a safe production deploy.

## Build-time vs runtime loading (Vercel)

Use this rule:
- **Build-time + runtime**: all `NEXT_PUBLIC_*` vars used by client/server bundles.
- **Runtime only (server secrets)**: non-`NEXT_PUBLIC_*` secrets for API routes.

### Build-time + runtime (must be set in Vercel for Production)
- `NEXT_PUBLIC_APP_ENV=production`
- `NEXT_PUBLIC_SITE_URL=https://dazrael.com`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_...`)
- `ALLOWED_ORIGINS` (include `https://dazrael.com` and `https://www.dazrael.com`)

### Runtime only (server secrets, Production env scope)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_PRICE_ID_PRO` (or legacy `STRIPE_PRICE_ID`)
- `STRIPE_PRICE_ID_CLOSER_ANNUAL`
- `STRIPE_PRICE_ID_CLOSER_PLUS`
- `STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL`
- `STRIPE_PRICE_ID_TEAM` **or** (`STRIPE_PRICE_ID_TEAM_BASE` + `STRIPE_PRICE_ID_TEAM_SEAT`)
- `STRIPE_PRICE_ID_TEAM_ANNUAL` **or** (`STRIPE_PRICE_ID_TEAM_BASE_ANNUAL` + `STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL`)
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional runtime-only email stack (required if enabled):
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL` (recommended)
- `LIFECYCLE_EMAILS_ENABLED`
- `LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED`
- `LIFECYCLE_ADMIN_EMAILS` (required when admin notifications enabled)

## Stripe (Billing)

**Required**
- `STRIPE_SECRET_KEY` (**secret**): `sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public): `pk_live_...`
- `STRIPE_WEBHOOK_SECRET` (**secret**): `whsec_...` for your production webhook endpoint
- Complete production price matrix:
  - `STRIPE_PRICE_ID_PRO` (or `STRIPE_PRICE_ID`) monthly
  - `STRIPE_PRICE_ID_CLOSER_ANNUAL`
  - `STRIPE_PRICE_ID_CLOSER_PLUS`
  - `STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL`
  - `STRIPE_PRICE_ID_TEAM` (or base+seat monthly pair)
  - `STRIPE_PRICE_ID_TEAM_ANNUAL` (or base+seat annual pair)

**How pricing works**
- Checkout supports monthly + annual for Pro / Pro+ / Agency.
- Payment method is collected up-front (no Stripe trial configured in checkout flow).

## Supabase migrations (production branch)

- Migrations are now **strictly sequential** and **zero-padded** (`0001_...` → `00NN_...`) with **no duplicates/gaps**.
- If you have an existing database created from older, duplicate-numbered migrations, prefer creating a fresh environment and applying the new chain.
- Local verification (recommended):
  - `supabase db reset --include-prod-env=false`
  - `supabase db push`


## Supabase (Auth + DB)

**Required**
- `NEXT_PUBLIC_SUPABASE_URL` (public): `https://<project>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (**secret**)
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` (public): should be `api`
- `SUPABASE_DB_SCHEMA_FALLBACK` (server): should be `api`

## Origin / URLs

**Required**
- `NEXT_PUBLIC_SITE_URL`: your production URL (e.g. `https://app.yourdomain.com`)
- `ALLOWED_ORIGINS`: comma-separated list of allowed origins (should include `NEXT_PUBLIC_SITE_URL`)
- `NEXT_PUBLIC_APP_ENV=production`

## Rate limiting (Upstash)

**Required in production**
- `UPSTASH_REDIS_REST_URL` (**secret**)
- `UPSTASH_REDIS_REST_TOKEN` (**secret**)

If these are missing in production, rate-limited routes will return **503** (intentional fail-closed).

## Observability (optional)

- `SENTRY_DSN` (optional)
- `SENTRY_ENVIRONMENT` (optional)

## Stripe webhook setup

1) Create a Stripe webhook endpoint pointing to:

`https://<your-domain>/api/stripe/webhook`

2) Add at least these events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

3) Copy the webhook signing secret (`whsec_...`) into:
- `STRIPE_WEBHOOK_SECRET`

4) Confirm feature flag behavior:
- `FEATURE_STRIPE_WEBHOOK_ENABLED` defaults to enabled unless explicitly `0/false`.
- If webhook feature is enabled, `STRIPE_WEBHOOK_SECRET` must be set.

## Local testing with Stripe CLI (recommended)

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Then set `STRIPE_WEBHOOK_SECRET=whsec_...` in `.env.local` and restart the dev server.

### Stripe CLI install (Windows)

PowerShell (Scoop):
```powershell
scoop install stripe
stripe --version
```

or Winget:
```powershell
winget install Stripe.StripeCLI
stripe --version
```

## Trigger Events Providers (optional, recommended)

LeadIntel can ingest Trigger Events from **multiple** news sources and merge/dedupe results.

**Recommended free-tier/dev config**
- `TRIGGER_EVENTS_PROVIDERS="newsapi,finnhub,gdelt,rss"`
- `NEWSAPI_API_KEY` (optional; no-ops if missing)
- `FINNHUB_API_KEY` (optional; can also reuse `MARKET_DATA_API_KEY`)
- `GDELT_BASE_URL` (optional; defaults to GDELT Doc API base)
- `TRIGGER_EVENTS_RSS_FEEDS` (optional; comma-separated RSS/Atom URLs)
- `TRIGGER_EVENTS_MAX_PER_PROVIDER` (optional; default 10)

**Notes**
- No provider is required; missing keys/feeds simply no-op.
- Legacy single-provider config is still supported via `TRIGGER_EVENTS_PROVIDER=none|newsapi|custom`.

## Trigger Events debug logging (optional)

Set `TRIGGER_EVENTS_DEBUG_LOGGING="true"` to emit **structured provider logs** (per-provider counts, timing, and a correlation id) for easier troubleshooting in local/staging.

Recommended: enable in **local/staging only**; keep off in production by default.

## Autopilot (optional, advanced)

Autopilot is an **advanced Pro-only feature** and can be fully hidden from the UI.

- `NEXT_PUBLIC_ENABLE_AUTOPILOT_UI=false` (recommended default)

If enabled, Autopilot also requires:
- A scheduler/cron job hitting `/api/autopilot/run`
- `autopilot_enabled=true` stored per tenant (managed via Settings)
- A configured email provider (e.g. Resend) for sending

