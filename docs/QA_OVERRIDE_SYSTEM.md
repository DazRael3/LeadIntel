# QA Override System (Internal Only)

This repo supports **internal-only QA tier overrides** so operators can test tier behavior without creating or modifying Stripe subscriptions.

## Goals
- Test **Starter / Closer / Closer+ / Team** behavior quickly
- Keep real billing truth untouched (no Stripe writes, no subscription mutation)
- Keep production safe: overrides only apply to allowlisted internal/test accounts
- Audit all changes

## How it works
- Overrides are stored in `api.qa_tier_overrides` (Supabase).
- Tier resolution (`GET /api/plan`) checks for an active override **only when**:
  - `ENABLE_QA_OVERRIDES=true`, and
  - the session email is allowlisted as an internal/test target
  - the user does **not** have an active/trialing Stripe subscription
- The UI shows a visible **“QA override”** badge when an override is active.

## Workspace requirement (management only)
- Viewing `/settings/qa` and listing overrides does **not** require a current workspace.
- Applying/revoking overrides **does** require a valid current workspace and an owner/admin role for audit scoping.
- The API will return a clear `422` “Workspace required” error if the actor has no workspace selected/available.

## Diagnostics panel
`/settings/qa` includes a small diagnostics panel that shows:
- Enabled / Disabled
- Configured / Misconfigured
- Actor allowlisted
- Workspace presence (for apply/revoke)
- API ready state

This is intentionally metadata-only (no secret/env dumps).

## Enablement (env)
Set in production/staging only when needed:
- `ENABLE_QA_OVERRIDES=true`

### Required allowlists (production-safe)
When `ENABLE_QA_OVERRIDES=true`, **both allowlists are required**. If either is missing/empty, the system **fails closed**:
- the API rejects requests with a clear configuration error
- overrides are not applied
- `/settings/qa` is only visible to emails explicitly present in `QA_OVERRIDE_ACTOR_EMAILS`

Set both as comma-separated email lists (case-insensitive, whitespace tolerated):
- `QA_OVERRIDE_ACTOR_EMAILS` — who can apply/revoke overrides
- `QA_OVERRIDE_TARGET_EMAILS` — which accounts can be overridden

Example:

```text
ENABLE_QA_OVERRIDES=true
QA_OVERRIDE_ACTOR_EMAILS=LeadIntel4Unity4All@dazrael.com
QA_OVERRIDE_TARGET_EMAILS=qa-closer@dazrael.com,qa-closerplus@dazrael.com,qa-team@dazrael.com
```

If `ENABLE_QA_OVERRIDES=false`, the system is inert.

## UI location
- `GET /settings/qa` (internal-only; requires auth + allowlist)

## Using the UI (step-by-step)
1. Ensure `ENABLE_QA_OVERRIDES=true` and you are signed in with an allowlisted actor email.
2. Visit `/settings/qa`.
3. Enter the **target test user email** (must be allowlisted).
4. Select the desired **Override tier**.
5. Set an expiry (minutes) and optional note.
6. Click **Apply override**.

### Revert
- In “Active overrides”, click **Revoke** for the target email.

## Safeguards
- **Actor allowlist**: only internal operators can manage overrides.
- **Target allowlist**: only internal/test accounts can be overridden.
- **No Stripe writes**: overrides are app-side only.
- **No paid subscription override**: active/trialing Stripe users are not overridden.
- **Audited**: actions are written to `api.audit_logs` via the API route.

