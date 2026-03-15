# Runtime cleanup notes (audit-driven)

This repo includes a local Playwright audit runner that surfaced a small set of high-value runtime polish issues. This note captures the **intentional fixes** applied so we don’t regress into noisy or broken-feeling states.

## Fixes applied

### 1) Workspace bootstrap reliability
- `/api/workspaces/current` no longer returns a generic `503` for valid logged-in users when workspace resolution is temporarily unavailable.
- Instead it returns an `ok: true` typed payload with `state` and `workspace: null` so the UI can render a calm “setup in progress/unavailable” state.

### 2) Marketing/info pages no longer mutate settings on mount
- Public pages (including when viewed while logged in) should not POST to `/api/settings` just to render.
- View tracking remains analytics-only (no settings mutation side effects).

### 3) Reduced avoidable auth-related request noise
- Links from public pages to auth-gated routes (login/signup/settings/dashboard) use `prefetch={false}` when appropriate to reduce avoidable aborted prefetch noise.

### 4) Canonical metadata coverage
- Key public routes now include `alternates.canonical` metadata so canonical tags are present and consistent on major conversion/trust pages.

### 5) Locked pages are productized
- Team-only surfaces render a premium locked-state with a real H1, a clear explanation, and a single primary upgrade CTA.

