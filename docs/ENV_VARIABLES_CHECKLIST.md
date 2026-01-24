# Environment Variables Checklist

Complete inventory of all environment variables used in LeadIntel codebase.

---

## Client-Safe Variables (NEXT_PUBLIC_*)

These variables are exposed to the browser and must not contain secrets.

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | `lib/supabase/*.ts` (all clients) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | `lib/supabase/*.ts` (all clients) | Supabase anonymous key (public) |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` | ⚠️ Optional | `lib/supabase/schema.ts` | Database schema (defaults to 'api') |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ Yes | `components/Pricing.tsx`, `app/api/checkout/route.ts` | Stripe publishable key (public) |
| `NEXT_PUBLIC_SITE_URL` | ⚠️ Optional | `app/api/checkout/route.ts`, `app/api/stripe/portal/route.ts` | Site URL for redirects |

**Total Client Variables**: 5 (3 required, 2 optional)

---

## Server-Only Variables (Secrets)

These variables are only available in server-side code and must never be exposed to the client.

### Supabase (Server)

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | `app/api/stripe/webhook/route.ts`, `app/api/dev/create-user/route.ts` | Supabase service role key (admin access) |
| `SUPABASE_DB_SCHEMA` | ⚠️ Optional | `lib/supabase/schema.ts` | Database schema override |
| `SUPABASE_DB_SCHEMA_FALLBACK` | ⚠️ Optional | `lib/supabase/schema.ts` | Fallback schema (defaults to 'api') |

### Stripe (Server)

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | ✅ Yes | `lib/stripe.ts`, `app/api/checkout/route.ts` | Stripe secret key (server-side) |
| `STRIPE_PRICE_ID` | ⚠️ Optional | `app/api/checkout/route.ts` | Stripe recurring price ID (fallback) |
| `STRIPE_PRICE_ID_PRO` | ✅ Yes | `app/api/checkout/route.ts` | Stripe recurring price ID for Pro ($99/mo) |
| `STRIPE_TRIAL_FEE_PRICE_ID` | ✅ Yes | `app/api/checkout/route.ts` | Stripe **one-time** price ID for trial fee ($25) |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | `app/api/stripe/webhook/route.ts` | Stripe webhook signing secret |

### OpenAI

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | `lib/ai-logic.ts`, `app/api/generate-pitch/route.ts`, `app/api/generate-battle-card/route.ts`, `app/api/generate-sequence/route.ts`, `app/api/generate-linkedin-comment/route.ts` | OpenAI API key |

### Resend (Email)

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | ⚠️ Optional | `app/api/send-pitch/route.ts` | Resend API key for email sending |
| `RESEND_FROM_EMAIL` | ⚠️ Optional | `app/api/send-pitch/route.ts` | From email address (defaults to noreply@leadintel.com) |
| `RESEND_WEBHOOK_SECRET` | ⚠️ Optional | `app/api/resend/webhook/route.ts` | Resend webhook signing secret (raw-body verification) |

### Clearbit (Company Enrichment)

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `CLEARBIT_REVEAL_API_KEY` | ⚠️ Optional | `app/api/tracker/route.ts`, `app/api/reveal/route.ts` | Clearbit Reveal API key (Ghost Reveal) |
| `CLEARBIT_API_KEY` | ⚠️ Optional | `app/api/generate-pitch/route.ts` | Clearbit API key (company enrichment) |

### Optional Third-Party Integrations

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `HUNTER_API_KEY` | ⚠️ Optional | `app/api/verify-email/route.ts` | Hunter.io API key (email verification) |
| `NEWS_API_KEY` | ⚠️ Optional | `app/api/generate-pitch/route.ts` | News API key (market pulse) |
| `ZAPIER_WEBHOOK_URL` | ⚠️ Optional | `app/api/push-to-crm/route.ts` | Zapier webhook URL (CRM integration) |
| `ADMIN_DIGEST_SECRET` | ⚠️ Optional | `app/api/digest/run/route.ts` | Admin digest webhook secret |
| `DEV_SEED_SECRET` | ⚠️ Optional | `app/api/dev/create-user/route.ts` | Dev user creation secret (dev only) |
| `CRON_SECRET` | ⚠️ Optional | `lib/api/guard.ts`, `vercel.json` | Legacy cron secret (header `X-CRON-SECRET`) |
| `CRON_SIGNING_SECRET` | ⚠️ Optional | `lib/api/cron-auth.ts`, `lib/api/guard.ts` | Cron token signing secret (preferred) |
| `CRON_TOKEN_AUTOPILOT` | ⚠️ Optional | `vercel.json` | Precomputed token for `POST /api/autopilot/run` (`cron_token`) |
| `CRON_TOKEN_DISCOVER` | ⚠️ Optional | `vercel.json` | Precomputed token for `POST /api/leads/discover` (`cron_token`) |
| `CRON_TOKEN_DIGEST` | ⚠️ Optional | `vercel.json` | Precomputed token for `POST /api/digest/run` (`cron_token`) |
| `SENTRY_DSN` | ⚠️ Optional | `lib/observability/sentry.ts` | Sentry DSN (enables real error reporting; empty disables) |
| `SENTRY_ENVIRONMENT` | ⚠️ Optional | `lib/observability/sentry.ts` | Sentry environment name |
| `HEALTH_CHECK_EXTERNAL` | ⚠️ Optional | `lib/services/health.ts` | Enable shallow external provider checks (prod default is off) |
| `FEATURE_AUTOPILOT_ENABLED` | ⚠️ Optional | `lib/services/feature-flags.ts`, `/api/autopilot/run` | Global kill switch for autopilot sending (`0/false` disables) |
| `FEATURE_RESEND_WEBHOOK_ENABLED` | ⚠️ Optional | `lib/services/feature-flags.ts`, `/api/resend/webhook` | Global kill switch for Resend webhook processing (`0/false` disables DB writes) |
| `FEATURE_STRIPE_WEBHOOK_ENABLED` | ⚠️ Optional | `lib/services/feature-flags.ts`, `/api/stripe/webhook` | Global kill switch for Stripe webhook processing (`0/false` disables business updates; still ACKs) |
| `FEATURE_CLEARBIT_ENABLED` | ⚠️ Optional | `lib/services/feature-flags.ts`, `/api/reveal` | Global kill switch for Clearbit enrichment (`0/false` disables) |
| `FEATURE_ZAPIER_PUSH_ENABLED` | ⚠️ Optional | `lib/services/feature-flags.ts`, `/api/push-to-crm` | Global kill switch for Zapier push (`0/false` disables) |

### Application

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | ⚠️ Auto-set | Multiple files (dev checks) | Node environment (development/production/test) |

**Total Server Variables**: 17 (5 required, 12 optional)

---

## Notes

- `lib/env.ts` is the **source of truth** for env validation.
- Prefer `serverEnv` / `clientEnv` usage to avoid accidentally reading secrets in client bundles.
- This doc intentionally does **not** attempt to maintain a “file-by-file migration status” section, as it becomes stale quickly.

## Validation Rules

### Format Validation
- **Stripe keys**: Must start with `sk_` (secret) or `pk_` (publishable)
- **Stripe webhook secret**: Must start with `whsec_`
- **Stripe price ID**: Must start with `price_`
- **OpenAI API key**: Must start with `sk-`
- **Resend API key**: Must start with `re_`
- **Supabase URL**: Must be valid URL
- **Email addresses**: Must be valid email format

### Required vs Optional
- **Required**: Validated at module load time, app fails to start if missing
- **Optional**: Can be undefined, code handles missing values gracefully

---

## Security Notes

1. **Client-safe variables** (NEXT_PUBLIC_*) are exposed to the browser
   - Never put secrets in NEXT_PUBLIC_* variables
   - Only use for public keys (Supabase anon key, Stripe publishable key)

2. **Server-only variables** are never exposed to client
   - `serverEnv` throws error if accessed in client code
   - All secrets are server-side only

3. **Validation happens at module load time**
   - App fails fast if required variables are missing
   - Clear error messages guide developers to fix issues

---

## Next Steps

1. ✅ Create `lib/env.ts` with Zod validation
2. ✅ Update critical files (`lib/stripe.ts`, `lib/ai-logic.ts`, etc.)
3. ⚠️ Update remaining API routes to use `serverEnv`/`clientEnv`
4. ⚠️ Update Supabase client files to use `clientEnv`
5. ✅ Create `.env.example` (template provided in docs)
6. ✅ Create test file `lib/env.test.ts`
7. ⚠️ Set up test runner (Jest/Vitest) if not already configured

---

**Last Updated**: January 2026  
**Total Variables**: 22 (5 client, 17 server)  
**Required Variables**: 8 (3 client, 5 server)  
**Optional Variables**: 14 (2 client, 12 server)
