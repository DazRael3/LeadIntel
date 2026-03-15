# Dashboard bootstrap and workspace resolution

The dashboard chrome expects a “current workspace” context for multi-workspace behavior.

## `/api/workspaces/current` response contract

This endpoint returns an `ok: true` response for authenticated users even when a workspace is not currently resolvable, so the UI can render intentionally instead of failing with generic `503` noise.

### States

- **`state: "ready"`**
  - `workspace` is present and valid for the user.
  - `role` is the membership role (or `null` if unavailable).

- **`state: "missing"`**
  - No workspace could be resolved for the user (e.g. fresh account).
  - The client should render a calm setup prompt (no destructive UI).

- **`state: "bootstrap_unavailable"`**
  - Workspace bootstrap was attempted but failed (transient issue).
  - The client should render a calm retry/support state.

### Non-recoverable state

- **`424 SCHEMA_MIGRATION_REQUIRED`**
  - Indicates the Supabase `api` schema is not exposed to PostgREST or migrations are missing.
  - This should be treated as an environment/config issue rather than a user error.

## UI guidance

- Top chrome must not spam destructive toasts for workspace resolution failures.
- Prefer stable badges like “Workspace setup” until the context is ready.
- Avoid mounting Team-only data hooks until a workspace context is stable and the user is entitled.

