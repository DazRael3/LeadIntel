# Production Environment Checklist (Vercel + Supabase + Stripe)

This document lists the **minimum required** environment variables for a safe production deploy.

## Stripe (Billing)

**Required**
- `STRIPE_SECRET_KEY` (**secret**): `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` (**secret**): `whsec_...` for your production webhook endpoint
- `STRIPE_PRICE_ID_PRO` (**secret-ish**): `price_...` for the **recurring $99/month** price
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public): `pk_live_...`

**How pricing works**
- The checkout session uses **subscription mode** for the **$99/month** Pro plan
- Payment method is collected up-front (no Stripe trial configured)

## Optional: App-level 3-day trial (no Stripe changes)

- `ENABLE_APP_TRIAL` (optional): set to `true` / `1` to enable a 3-day **app-level** Pro trial for new users. This does **not** change Stripe billing or create a Stripe trial.

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

## Local testing with Stripe CLI (recommended)

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Then set `STRIPE_WEBHOOK_SECRET=whsec_...` in `.env.local` and restart the dev server.

