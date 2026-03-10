## Rollout workflows (template distribution)

LeadIntel supports distributing an approved template/playbook across multiple workspaces using **copy semantics**.

This supports agency / partner operating models without creating shared mutable global objects.

## Copy semantics (no inheritance)

When a rollout is applied:

- the template is **copied** into the target workspace
- the copy is created as **draft** to allow local governance (approval workflows) to apply
- import metadata is recorded on the new template row:
  - `import_source = 'imported'`
  - `origin_workspace_id`
  - `origin_template_id`
  - `imported_at`, `imported_by`

We do not implement template inheritance/version propagation in this wave.

## Permissions

Rollout creation and apply requires:

- owner/admin role in the **source** workspace
- owner/admin role in each **target** workspace

Targets where the actor lacks permissions are **skipped** (explicitly recorded).

## Storage + API

- Tables: `api.rollout_jobs`, `api.rollout_items`
- API: `GET/POST /api/partners/rollouts`
- UI: `/dashboard/rollouts`

## Auditing

- Rollout creation is audited (`rollout.created`)
- Per-target results are stored as rollout items with sanitized error text

