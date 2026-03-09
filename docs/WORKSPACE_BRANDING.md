## Workspace branding (bounded)

This wave adds workspace presentation controls intended for multi-workspace operators:

- workspace name (`api.workspaces.name`)
- optional client/project label (`api.workspaces.client_label`)
- optional reference tags (`api.workspaces.reference_tags`)

These are **labels only** and do not implement:

- white-labeling
- custom domains
- branded emails

## UI + API

- Settings: `/settings/branding`
- API: `/api/workspace/branding` (GET/PATCH)

Permissions:

- any member can view
- only owner/admin can edit

