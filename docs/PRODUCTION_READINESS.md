# Production Readiness (Go‑Live Checklist)

**Source of truth for env variables is `lib/env.ts`.** If you change env validation there, update this doc to match.

This app uses **Next.js 14 + Supabase + Stripe + Sentry**. Environment variables are validated with Zod at runtime:
- **Client-safe** vars live in the `clientEnv` schema (browser-exposed, `NEXT_PUBLIC_*`).
- **Server-only** vars live in the `serverEnv` schema (API routes / server components only).
- A few `NEXT_PUBLIC_*` vars are also validated in `serverEnv` so ops checks can treat `serverEnv` as a single source when debugging deployments.

---

## Platform wave: operational trust

This wave adds operational trust primitives (inspectability, predictable retries, metadata-first tooling).

- **Admin/operator pages** are token-gated via `ADMIN_TOKEN` (`/admin/*`) and set `robots: noindex`.
- **Audit and support tooling** is metadata-first:
  - no pitch/report bodies
  - no webhook secrets
  - no raw provider payloads
- **Freshness and quality** are surfaced as coarse labels (“limited / usable / strong”, “stale / recent / fresh”) instead of over-precise confidence.
- **Retry-safe endpoints** avoid duplicate job/report/brief creation under retries and repeated clicks.
- **Integrations + actions** are Team-gated and destination-based:
  - handoffs are prepared/queued first, then delivered via configured webhooks/exports
  - delivery history is sanitized (status + correlation IDs, no secrets)

---

## Platform wave: partner + multi-workspace operations

This wave adds multi-workspace support without weakening isolation:

- **Current workspace selection** is persisted per user (`api.users.current_workspace_id`) and validated against membership.
- **Workspace switching** is explicit and audited (`workspace.switched`).
- **Partner/agency overview** surfaces are **summary-safe** and never show cross-workspace account lists or payload bodies.
- **Delegated access** is explicit, revocable, and auditable; it is implemented as a delegated membership row for workspace-scoped RLS.
- **Rollouts** distribute templates via copy semantics (draft in target workspace; origin metadata retained).

---

## Platform wave: API platform + embeds + extensibility

This wave adds a bounded developer surface without weakening security or entitlement enforcement:

- **Workspace-scoped API keys** (hashed storage, shown once, revocable, scoped).
- **Versioned platform API** (`/api/v1/*`) with typed envelopes and stable platform objects.
- **Platform governance controls** (`/settings/platform`) to enable/disable API access, embeds, and extensions per workspace.
- **Embed mode (bounded)** with signed, short-lived tokens and embed-safe widgets under `/embed/*`.
- **Extensions (custom actions)**: validated payload templates delivered via existing webhook infrastructure.
- **API usage visibility** via sanitized request logs (`/settings/api/usage`).

---

## Platform wave: mobile workflows + executive reporting + command center

This wave improves small-screen usability and adds bounded summary surfaces without turning LeadIntel into BI:

- **Mobile-first summaries** are responsive web views (no native app claims).
- **Dashboard request discipline**: Starter/preview users must not mount or request Team-only / Pro-only modules (no background 403/500 spam). Tabs must be mount-on-active to avoid hidden modules firing requests.
- **Executive dashboard** (`/dashboard/executive`) is **metadata-first** and role-gated (default: owner/admin/manager).
- **Executive snapshots** (`POST /api/executive/snapshot`) produce **copy/print** summaries (no premium body content).
- **Command Center** (`/dashboard/command-center`) is a daily operating console built from observed queue + approvals.
- **Reporting governance** is configurable under `/settings/reporting` and enforced server-side for all reporting endpoints.

## Audit-driven runtime polish notes

Recent high-value runtime stabilization/polish notes live here:
- `docs/RUNTIME_CLEANUP_NOTES.md`
- `docs/PUBLIC_REQUEST_HYGIENE.md`
- `docs/DASHBOARD_BOOTSTRAP_AND_WORKSPACE_RESOLUTION.md`
- `docs/LOCKED_ROUTE_STANDARDS.md`
- `docs/MOBILE_READINESS.md`
- `docs/ACTIVATION_AND_CONVERSION_NOTES.md`
- `docs/SUPPORT_AND_FEEDBACK_LOOP.md`

## Private route metadata policy

Authenticated/private routes (dashboard + settings surfaces) are intentionally marked:
- `robots: noindex, nofollow`

Rationale:
- These pages are user-specific and not meant for indexing.
- Public pages should carry canonical metadata; private pages should not accidentally signal indexability.

---

## Platform wave: assistants + conversational workflows

This wave adds a **grounded assistant layer** without introducing fake autonomy:

- **Assistant governance** is configurable under `/settings/assistant` and enforced server-side for all assistant endpoints.
- **Assistant conversations** are workspace-scoped and (optionally) stored as object-attached threads.
- **Assistant actions** are preview-first and require explicit confirmation to execute.
- **No** automatic outreach sending, and no cross-workspace access.

---

## Lightweight feedback capture

LeadIntel includes a minimal feedback loop for low-ops product learning:
- **DB**: `api.feedback` (privacy-safe, short text only)
- **API**: `POST /api/feedback` (rate-limited, origin-enforced)
- **Surfaces**: Support page + Starter dashboard

---

## Verification matrix (lean)

Keep verification lightweight and production-oriented. Validate the matrix below at least once per meaningful release.

### Apex / www parity (must match)
For each action below, verify behavior is identical when accessed from:
- `https://dazrael.com`
- `https://www.dazrael.com`

**Key POST/actions**
- Sample digest: `POST /api/sample-digest`
- Feedback: `POST /api/feedback`
- Analytics (best-effort): `POST /api/analytics/track`
- Checkout start: `POST /api/checkout` (auth/plan-gated; should return correct 401/403 envelope, never blank 500)

**Origin enforcement requirements**
- Disallowed Origin returns a **proper error envelope** (not an empty-body 500).
- Allowed Origin includes apex+www parity.

### Mobile readiness (phone widths)
- 320 / 360 / 390 / 430: public pages + logged-in dashboard first screen

### Tier coherence (Starter / Closer / Closer+ / Team)
- Nav items, locked states, upgrade messaging, and mobile behavior are coherent (no contradictory badges/labels).

---

## Internal QA tier overrides

For safe internal testing without billing mutation, see:
- `docs/QA_OVERRIDE_SYSTEM.md`


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

### Platform API / embeds (optional)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `PLATFORM_API_KEY_PEPPER` | server-only | Pepper used when hashing workspace API keys. Required if platform API access is enabled. | Keep stable per environment; rotate only with a key rotation plan. |
| `EMBED_SIGNING_SECRET` | server-only | Secret used to sign short-lived embed tokens. Required if embed mode is enabled. | Keep stable per environment. |

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

### Experimentation (growth ops)
| Name | Scope | Purpose | TEST vs LIVE |
| --- | --- | --- | --- |
| `EXPERIMENT_ASSIGNMENT_SEED` | server-only | Stable seed for deterministic experiment assignment. | Keep stable per environment for consistent bucketing. |
| `NEXT_PUBLIC_EXPERIMENTS_ENABLED` | client-safe | Enables experiment evaluation calls from eligible UI surfaces. | Recommended `false` until governance is configured; gate via workspace policies. |

### Revenue intelligence (closed-loop CRM)
This wave adds **DB tables + workspace policies**, but **no new required environment variables**.

- Apply migration `0062_closed_loop_crm_intelligence.sql`
- Configure access via workspace policies under `policies.revenueIntelligence.*`

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
  - Reports list remains **reports-only**; pitch previews appear under **Recent premium activity**.
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

