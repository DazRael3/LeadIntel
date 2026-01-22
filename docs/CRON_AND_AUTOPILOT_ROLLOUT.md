## Cron auth + Autopilot rollout (Phase-1)

This repo supports **automation endpoints** that can be invoked by a scheduler (Vercel Cron, etc.)
**without** an end-user Supabase session, while preserving rate limits and standardized responses.

Targets:
- `/api/autopilot/run`
- `/api/leads/discover`
- `/api/digest/run`

---

### Cron authentication (robust to custom-header limitations)

Cron auth is implemented centrally in `lib/api/guard.ts` and enabled per-route via `cronAllowed`
in `lib/api/policy.ts`.

The guard accepts cron-auth in **either** of these ways:

1) **Preferred**: signed query token
- Provide `?cron_token=...` on the request URL.
- The token is verified using `CRON_SIGNING_SECRET` and the request’s `(method, pathname)`.
- Verification is constant-time (no token logging).

2) **Legacy fallback**: `X-CRON-SECRET` header
- Provide `X-CRON-SECRET` matching `CRON_SECRET`.
- This is kept for compatibility, but some schedulers may strip/ignore custom headers.

If cron auth fails, the route behaves like a normal protected endpoint and requires Supabase auth.

---

### Required environment variables

Server:
- `CRON_SIGNING_SECRET` (recommended): used to validate `cron_token`
- `CRON_SECRET` (legacy): used to validate `X-CRON-SECRET`

---

### Generating cron tokens

Cron tokens are **route-specific** (bound to method + pathname). Generate them offline and store as secrets.

Example (Node):

```bash
node - <<'NODE'
const crypto = require('crypto')
const signingSecret = process.env.CRON_SIGNING_SECRET
if (!signingSecret) throw new Error('Missing CRON_SIGNING_SECRET')
function token(method, path) {
  const msg = `v1:${method.toUpperCase()}:${path}`
  return crypto.createHmac('sha256', signingSecret).update(msg).digest('base64url')
}
console.log('AUTOPILOT:', token('POST', '/api/autopilot/run'))
console.log('DISCOVER :', token('POST', '/api/leads/discover'))
console.log('DIGEST   :', token('POST', '/api/digest/run'))
NODE
```

Then set these as deployment secrets (recommended names used by `vercel.json`):
- `CRON_TOKEN_AUTOPILOT`
- `CRON_TOKEN_DISCOVER`
- `CRON_TOKEN_DIGEST`

---

### Vercel Cron configuration

`vercel.json` includes both:
- `cron_token` query param (preferred)
- `X-CRON-SECRET` header (legacy)

This dual approach is intentional to handle scheduler behavior differences.

---

## Autopilot rollout safety

Autopilot is gated per-tenant via:
- `api.user_settings.autopilot_enabled boolean NOT NULL DEFAULT false`
  - added by `supabase/migrations/0013_autopilot_enabled.sql`

Behavior:
- **Cron-triggered** `/api/autopilot/run` only processes tenants where `autopilot_enabled = true`.
- **Manual** runs are restricted to the authenticated user’s tenant, and non-dry-run requires `autopilot_enabled = true`.

---

## Digest + Discover behavior (cron)

- `POST /api/digest/run`:
  - Cron calls run in **system mode** (no end-user Supabase session) and use the **service role** to read digest-enabled tenants.
  - Manual/admin calls require `x-admin-digest-secret` (no end-user session required) and also use the service role.

- `POST /api/leads/discover`:
  - Currently a placeholder route wired for cron auth + rate limiting.

### Enabling/disabling autopilot

In the dashboard, use the **Settings** tab to toggle Autopilot for your user.
This calls `POST /api/settings/autopilot` (authenticated, origin-checked, validated, rate-limited).

