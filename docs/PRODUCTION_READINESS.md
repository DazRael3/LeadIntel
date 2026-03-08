# Production Readiness (Go‑Live Checklist)

**Source of truth for env variables is `lib/env.ts`.** If you change env validation there, update this doc to match.

This app uses **Next.js 14 + Supabase + Stripe + Sentry**. Environment variables are validated with Zod at runtime:
- **Client-safe** vars live in the `clientEnv` schema (browser-exposed, `NEXT_PUBLIC_*`).
- **Server-only** vars live in the `serverEnv` schema (API routes / server components only).
- A few `NEXT_PUBLIC_*` vars are also validated in `serverEnv` so ops checks can treat `serverEnv` as a single source when debugging deployments.

---

## Required env vars (production)

### App URL / Origin
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | client-safe + server | Canonical app base URL used for redirects and absolute links. **Required in production**. | Must match the deployed environment (use **HTTPS** on live). |
| `ALLOWED_ORIGINS` | client-safe | Comma-separated allowlist for Origin enforcement on state-changing API routes. | Should include `NEXT_PUBLIC_SITE_URL` for the same environment. |

### Supabase
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client-safe + server | Supabase project URL (PostgREST/Auth). | Point to the correct Supabase project (staging vs prod). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client-safe + server | Supabase anon key used by browser clients. | Use the matching key for that project/environment. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Service role key used for privileged server-side operations. | Use the matching key for that project/environment. |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` | client-safe | Client-side schema selection (defaults to `api`). | Same across envs; keep `api` unless you know what you’re doing. |
| `SUPABASE_DB_SCHEMA_FALLBACK` | server-only | Server-side schema fallback (defaults to `api`). | Same across envs; keep `api`. |

**Supabase production checklist**
- In Supabase → Settings → API, ensure **`api`** is in **Exposed schemas**.
- Ensure RLS policies are enabled and correct for all `api.*` tables.

### Stripe (billing)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client-safe + server | Stripe publishable key used by the browser. | `pk_test_...` in sandbox; `pk_live_...` in production. |
| `STRIPE_SECRET_KEY` | server-only | Stripe secret key used by API routes. | **Key prefix determines mode**: `sk_test_...` vs `sk_live_...`. |
| `STRIPE_WEBHOOK_SECRET` | server-only | Stripe webhook signing secret (`whsec_...`). | Different webhook endpoints per environment → different `whsec_...`. |
| `STRIPE_PRICE_ID_PRO` | server-only | Price ID for **Closer/Pro** subscription checkout. | Price IDs are always `price_...` but must come from the same Stripe mode (test vs live) as the secret key. |
| `STRIPE_PRICE_ID` | server-only | Legacy fallback price ID for Pro checkout (optional). | Same as above; prefer `STRIPE_PRICE_ID_PRO`. |
| `STRIPE_PRICE_ID_TEAM` | server-only | Price ID for **Team** checkout (required only if offering Team). | Same as above; test vs live price IDs must match your Stripe key mode. |

**Stripe go-live checklist**
- Confirm `/api/checkout` returns `200` and redirects to Stripe Checkout when price IDs are set.
- Confirm Stripe webhooks are configured to hit `/api/stripe/webhook` for the environment.

### OpenAI (AI generation)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | server-only | OpenAI API key used for pitch generation. | Use the appropriate key for the environment/account. |

---

## Recommended env vars (production)

### Sentry (observability)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `SENTRY_DSN` | server-only | Enables Sentry error reporting when set (empty disables). | Use the DSN for the target environment/project. |
| `SENTRY_ENVIRONMENT` | server-only | Sentry environment tag (e.g. `production`, `staging`). | Match your deployment environment name. |

### Upstash Redis (rate limiting)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | server-only | Upstash REST URL for rate limiting / usage caps. | Point to the correct Upstash instance for the environment. |
| `UPSTASH_REDIS_REST_TOKEN` | server-only | Upstash REST token for rate limiting / usage caps. | Same as above. |

---

## Optional integrations / feature config (set only if used)

### Resend (email)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | server-only | Enables sending emails via Resend. | Use the right Resend key for the environment. |
| `RESEND_FROM_EMAIL` | server-only | Default From address for outbound mail. | Use a verified sender/domain per environment. |
| `RESEND_WEBHOOK_SECRET` | server-only | Secret for Resend webhook verification (if enabled). | Configure per webhook/environment. |

### Market data (optional live quotes)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `MARKET_DATA_PROVIDER` | server-only | Optional live quotes provider (`finnhub` or `polygon`). | Provider/key should match the environment/account. |
| `MARKET_DATA_API_KEY` | server-only | API key for the selected market data provider. | Same as above. |
| `FINNHUB_API_KEY` | server-only | Optional Finnhub key used for best-effort logos + trigger providers. | Same as above. |

### Trigger events ingestion (optional)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `TRIGGER_EVENTS_PROVIDER` | server-only | Legacy single-provider selector (`none`, `newsapi`, `custom`). | Use providers appropriate to the environment. |
| `TRIGGER_EVENTS_PROVIDERS` | server-only | Preferred multi-provider list (comma-separated). | Same as above. |
| `TRIGGER_EVENTS_CRON_SECRET` | server-only | Auth secret for `/api/trigger-events/ingest`. | Separate secrets per environment. |
| `NEWSAPI_API_KEY` | server-only | NewsAPI key (optional). | Same as above. |
| `GDELT_BASE_URL` | server-only | Optional GDELT base URL. | Same as above. |
| `CRUNCHBASE_API_KEY` | server-only | Optional Crunchbase key. | Same as above. |
| `TRIGGER_EVENTS_RSS_FEEDS` | server-only | Optional RSS feeds list. | Same as above. |
| `TRIGGER_EVENTS_MAX_PER_PROVIDER` | server-only | Optional cap per provider per run. | Same as above. |
| `TRIGGER_EVENTS_DEBUG_LOGGING` | server-only | Enables extra provider logs (recommended off in prod). | Same as above. |
| `ENABLE_DEMO_TRIGGER_EVENTS` | server-only | Seeds demo events (recommended **false** in prod). | Same as above. |

### Site reports (optional admin/cron)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `ENABLE_SITE_REPORTS` | server-only | Enables `/api/admin/site-report/run`. | Same as above. |
| `SITE_REPORT_CRON_SECRET` | server-only | Cron secret header value for report runs. | Separate secrets per environment. |
| `ADMIN_USER_ID` | server-only | Supabase user id allowed to read latest report. | Set to your real admin account in that environment. |

### Global feature flags / kill switches (optional)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `FEATURE_AUTOPILOT_ENABLED` | server-only | Global kill switch for autopilot. | Same as above. |
| `FEATURE_RESEND_WEBHOOK_ENABLED` | server-only | Global kill switch for Resend webhooks. | Same as above. |
| `FEATURE_STRIPE_WEBHOOK_ENABLED` | server-only | Global kill switch for Stripe webhooks. | Same as above. |
| `FEATURE_CLEARBIT_ENABLED` | server-only | Global kill switch for Clearbit. | Same as above. |
| `FEATURE_ZAPIER_PUSH_ENABLED` | server-only | Global kill switch for Zapier. | Same as above. |

### Dev/test helpers (should be OFF in production)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `DEV_SEED_SECRET` | server-only | Secret used for dev-only tooling (guard x-dev-key / dev endpoints). | Don’t set in production unless you know why. |
| `NEXT_PUBLIC_ENABLE_DEBUG_UI` | client-safe | Enables debug panel UI. | Recommended `false` in prod; code also hard-disables it in production. |

---

## Operational checks (post-deploy)

- Verify `/api/health` returns `ok: true` and DB/Auth checks pass.
- Verify `/status` shows Operational when critical dependencies are healthy.
- Verify **Free-tier premium generation enforcement**:
  - A Free (Starter) user can successfully complete up to **3 total** premium generations across **pitches + reports**.
  - The 4th attempt is blocked server-side with `FREE_TIER_GENERATION_LIMIT_REACHED` (429).
  - Free responses do **not** include full premium pitch/report text (preview-only + locked UI).
| `NEXT_PUBLIC_ENABLE_AUTOPILOT_UI` | client-safe | Shows autopilot UI. | Recommended `false` in prod unless using autopilot. |

---

## Quick checklist for deploy

### Stripe
- [ ] `STRIPE_SECRET_KEY` matches mode (`sk_test_...` or `sk_live_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` set for this environment’s webhook endpoint
- [ ] `STRIPE_PRICE_ID_PRO` set (and matches Stripe mode)
- [ ] `STRIPE_PRICE_ID_TEAM` set (if Team is offered)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set (and matches mode)

### Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] Supabase API exposes schema `api`
- [ ] RLS policies verified for `api.*` tables (no cross-tenant leakage)

### Sentry
- [ ] `SENTRY_DSN` set (or intentionally empty)
- [ ] `SENTRY_ENVIRONMENT=production` (or `staging`, etc.)

### App URL
- [ ] `NEXT_PUBLIC_SITE_URL` is **https://** and matches the deployed domain
- [ ] `ALLOWED_ORIGINS` includes that domain

### Redis / rate limiting
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set (if rate limiting should be enabled)

