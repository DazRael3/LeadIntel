## Observability + Health (production ops)

This repo uses a **small observability facade** (`lib/observability/sentry.ts`) to keep call sites stable
and to avoid leaking secrets/PII.

It also provides a lightweight **health endpoint** for uptime monitoring: `GET /api/health`.

> Note: your environment file is `.env.local` for local development.

---

### Sentry integration

Facade: `lib/observability/sentry.ts`

Behavior:
- If `SENTRY_DSN` is **unset/empty**, observability calls **no-op** (dev/test/e2e stays clean).
- If `SENTRY_DSN` is set, the facade lazily initializes `@sentry/nextjs` and forwards:
  - `captureException`
  - `captureMessage`
  - `captureBreadcrumb`
  - `setRequestId`

Security/privacy rules:
- We **do not** attach raw request bodies, webhook payloads, email bodies, or tokens.
- Only safe metadata is attached (route, requestId, userId/tenant id, provider name, cron vs manual, dryRun).
- Context keys that look like secrets (`token`, `cookie`, `authorization`, `api_key`, `secret`, `html`, `text`, `payload`, etc.)
  are automatically dropped.

Env vars (server):
- `SENTRY_DSN` (optional; empty string disables)
- `SENTRY_ENVIRONMENT` (optional; defaults to `NODE_ENV`)

---

### Health endpoint

Route: `GET /api/health`

Response (standard API envelope):
- `ok: true`
- `data.status`: `"ok" | "degraded" | "down"`
- `data.components`: `{ db, redis, supabaseApi, resend, openai, clearbit }`

Design goals:
- **Unauthenticated**, rate-limited (policy tier `HEALTH`)
- No secrets, no internal IDs in the response
- Minimal checks:
  - **db**: (production) service-role `select id from api.users limit 1`; (test-like) skipped
  - **supabaseApi**: GET `${SUPABASE_URL}/auth/v1/health` with short timeout
  - **redis**: read-only `GET` via Upstash
  - **resend/openai/clearbit**: “configured” checks by default; no provider calls

External provider checks:
- In non-production, the endpoint may perform slightly more active checks.
- In production, provider checks are **not performed** unless explicitly enabled:
  - `HEALTH_CHECK_EXTERNAL=1`

Env vars:
- `HEALTH_CHECK_EXTERNAL` (`0|1`, optional; default `0`)

Recommended usage:
- Point your uptime monitor (Pingdom/BetterUptime/etc.) at `GET /api/health`.
- Alert on `data.status === "down"`; optionally page on sustained `"degraded"`.

