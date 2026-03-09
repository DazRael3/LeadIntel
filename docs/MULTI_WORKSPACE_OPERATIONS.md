## Operations overview (summary-safe)

Multi-workspace operations surfaces provide high-signal indicators without exposing protected content.

## Dashboard

- `/dashboard/operations`

Shows:

- approval backlog counts
- action queue “ready backlog (48h+)” counts
- webhook failures (7d) counts
- a short “needs attention” list (workspace-level only)

## Design constraints

- no account lists in cross-workspace views
- no webhook payload bodies
- no raw provider errors
- links into workspace context are done via explicit workspace switching

Implementation:

- API: `GET /api/partners/workspaces`
- UI: `app/dashboard/operations/*`

