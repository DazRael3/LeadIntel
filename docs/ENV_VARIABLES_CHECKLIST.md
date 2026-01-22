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
| `STRIPE_PRICE_ID` | ⚠️ Optional | `app/api/checkout/route.ts` | Stripe price ID for subscription |
| `STRIPE_PRICE_ID_PRO` | ⚠️ Optional | `app/api/checkout/route.ts` | Stripe price ID override for Pro tier |
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

### Application

| Variable | Required | Used In | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | ⚠️ Auto-set | Multiple files (dev checks) | Node environment (development/production/test) |

**Total Server Variables**: 17 (5 required, 12 optional)

---

## File-by-File Usage

### `lib/env.ts`
- **Purpose**: Centralized environment variable validation
- **Uses**: Zod schemas for validation
- **Exports**: `clientEnv`, `serverEnv`, `requireEnv()`, `getEnv()`

### `lib/stripe.ts`
- **Uses**: `serverEnv.STRIPE_SECRET_KEY`
- **Replaced**: `process.env.STRIPE_SECRET_KEY`

### `lib/ai-logic.ts`
- **Uses**: `serverEnv.OPENAI_API_KEY`
- **Replaced**: `process.env.OPENAI_API_KEY`

### `app/api/send-pitch/route.ts`
- **Uses**: `serverEnv.RESEND_API_KEY`, `serverEnv.RESEND_FROM_EMAIL`
- **Replaced**: `process.env.RESEND_API_KEY`, `process.env.RESEND_FROM_EMAIL`

### `app/api/checkout/route.ts`
- **Uses**: `serverEnv.STRIPE_PRICE_ID`, `serverEnv.STRIPE_PRICE_ID_PRO`, `clientEnv.NEXT_PUBLIC_SITE_URL`
- **Replaced**: `process.env.STRIPE_SECRET_KEY`, `process.env.STRIPE_PRICE_ID`, `process.env.NEXT_PUBLIC_SITE_URL`

### `app/api/stripe/webhook/route.ts`
- **Uses**: `serverEnv.STRIPE_WEBHOOK_SECRET`, `serverEnv.SUPABASE_SERVICE_ROLE_KEY`, `serverEnv.NODE_ENV`, `clientEnv.NEXT_PUBLIC_SUPABASE_URL`
- **Replaced**: `process.env.STRIPE_WEBHOOK_SECRET`, `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NODE_ENV`

### `app/api/generate-pitch/route.ts`
- **Uses**: `serverEnv.OPENAI_API_KEY`, `serverEnv.NODE_ENV`, `serverEnv.CLEARBIT_API_KEY`, `serverEnv.NEWS_API_KEY`
- **Replaced**: `process.env.OPENAI_API_KEY`, `process.env.NODE_ENV`, `process.env.CLEARBIT_API_KEY`, `process.env.NEWS_API_KEY`

### `app/api/generate-battle-card/route.ts`
- **Uses**: `serverEnv.OPENAI_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.OPENAI_API_KEY`

### `app/api/generate-sequence/route.ts`
- **Uses**: `serverEnv.OPENAI_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.OPENAI_API_KEY`

### `app/api/generate-linkedin-comment/route.ts`
- **Uses**: `serverEnv.OPENAI_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.OPENAI_API_KEY`

### `app/api/tracker/route.ts`
- **Uses**: `serverEnv.CLEARBIT_REVEAL_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.CLEARBIT_REVEAL_API_KEY`

### `app/api/reveal/route.ts`
- **Uses**: `serverEnv.CLEARBIT_REVEAL_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.CLEARBIT_REVEAL_API_KEY`

### `app/api/verify-email/route.ts`
- **Uses**: `serverEnv.HUNTER_API_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.HUNTER_API_KEY`

### `app/api/push-to-crm/route.ts`
- **Uses**: `serverEnv.ZAPIER_WEBHOOK_URL` (needs update)
- **Status**: ⚠️ Still uses `process.env.ZAPIER_WEBHOOK_URL`

### `app/api/digest/run/route.ts`
- **Uses**: `serverEnv.ADMIN_DIGEST_SECRET` (needs update)
- **Status**: ⚠️ Still uses `process.env.ADMIN_DIGEST_SECRET`

### `app/api/dev/create-user/route.ts`
- **Uses**: `serverEnv.SUPABASE_SERVICE_ROLE_KEY`, `serverEnv.DEV_SEED_SECRET`, `serverEnv.NODE_ENV`, `clientEnv.NEXT_PUBLIC_SUPABASE_URL` (needs update)
- **Status**: ⚠️ Still uses `process.env.*`

### `app/api/stripe/portal/route.ts`
- **Uses**: `clientEnv.NEXT_PUBLIC_SITE_URL` (needs update)
- **Status**: ⚠️ Still uses `process.env.NEXT_PUBLIC_SITE_URL`

### `lib/supabase/*.ts` (all client files)
- **Uses**: `clientEnv.NEXT_PUBLIC_SUPABASE_URL`, `clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY` (needs update)
- **Status**: ⚠️ Still uses `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`

### `lib/supabase/schema.ts`
- **Uses**: `clientEnv.NEXT_PUBLIC_SUPABASE_DB_SCHEMA`, `serverEnv.SUPABASE_DB_SCHEMA`, `serverEnv.SUPABASE_DB_SCHEMA_FALLBACK` (needs update)
- **Status**: ⚠️ Still uses `process.env.*`

### Client Components (NODE_ENV checks)
- **Files**: `app/login/LoginClient.tsx`, `app/dashboard/DashboardClient.tsx`, `components/OnboardingWizard.tsx`
- **Uses**: `process.env.NODE_ENV` (safe to keep - Next.js built-in)
- **Status**: ✅ OK (NODE_ENV is safe to use directly)

---

## Migration Status

### ✅ Completed
- `lib/env.ts` - Created with Zod validation
- `lib/stripe.ts` - Updated to use `serverEnv`
- `lib/ai-logic.ts` - Updated to use `serverEnv`
- `app/api/send-pitch/route.ts` - Updated to use `serverEnv`
- `app/api/checkout/route.ts` - Updated to use `serverEnv` and `clientEnv`
- `app/api/stripe/webhook/route.ts` - Updated to use `serverEnv` and `clientEnv`
- `app/api/generate-pitch/route.ts` - Updated to use `serverEnv`

### ⚠️ Pending Updates
- `app/api/generate-battle-card/route.ts`
- `app/api/generate-sequence/route.ts`
- `app/api/generate-linkedin-comment/route.ts`
- `app/api/tracker/route.ts`
- `app/api/reveal/route.ts`
- `app/api/verify-email/route.ts`
- `app/api/push-to-crm/route.ts`
- `app/api/digest/run/route.ts`
- `app/api/dev/create-user/route.ts`
- `app/api/stripe/portal/route.ts`
- `lib/supabase/*.ts` (all files)
- `lib/supabase/schema.ts`

---

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

**Last Updated**: January 2025  
**Total Variables**: 22 (5 client, 17 server)  
**Required Variables**: 8 (3 client, 5 server)  
**Optional Variables**: 14 (2 client, 12 server)
