## Delegated access model

Delegated access is an explicit, auditable way for a workspace owner/admin to grant a partner/operator access to the workspace.

This is useful for:

- rollout support
- operational debugging
- setup assistance

## What it does

- creates a `api.delegated_access_grants` row (audit-friendly record)
- creates/updates a `api.workspace_members` row with `membership_source = 'delegated'`

Because normal workspace RLS uses membership checks (`api.is_workspace_member(...)`), the delegated user is treated as a workspace member at the granted role.

## Governance / restrictions

- only **owner/admin** can grant or revoke in the current implementation
- delegated membership is revocable; revoke removes the delegated `workspace_members` row
- if the user is already a **direct** member, delegated access is not applied

## UI + API

- Settings: `/settings/partner-access`
- API: `/api/settings/partner-access` (GET/POST/DELETE)

## What we do NOT claim

- delegated billing
- hidden super-admin access
- cross-workspace read access beyond explicit membership

