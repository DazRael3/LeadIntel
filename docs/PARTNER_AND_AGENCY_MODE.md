## Purpose

Partner / agency mode is a **bounded operating model** for users who manage multiple client workspaces.

LeadIntel supports:

- viewing a directory of accessible workspaces
- seeing **summary-safe** operational health per workspace
- switching into a workspace to do scoped work (no mixed data)

## What partner mode is NOT

- a reseller billing engine
- white-labeling
- cross-client shared intelligence
- a global admin console with hidden joins

## Partner overview surface

Route:

- `/dashboard/partner`

The partner dashboard shows **workspace-level operational summaries only**:

- pending approvals count
- action queue backlog (48h+ ready items)
- webhook delivery failures (7d)
- deployment readiness “needs attention” count (coarse)

It does not show:

- account lists
- domains
- generated messaging bodies
- raw delivery payloads

Implementation:

- API: `GET /api/partners/workspaces`
- UI: `app/dashboard/partner/*`

