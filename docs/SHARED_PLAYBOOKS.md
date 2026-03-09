## Shared playbooks model (v1)

LeadIntel supports “shared playbooks” across workspaces via **distribution/copy**, not global mutation.

In this repo, “playbooks” are represented by workspace templates in `api.templates`.

## Modes

Supported:

- **workspace-local** templates
- **imported copies** created via rollout workflows

Not implemented (by design, to avoid unsafe claims):

- global shared objects that auto-update across client workspaces
- inheritance trees or automatic propagation

## Origin metadata

Imported templates include origin fields:

- `origin_workspace_id`
- `origin_template_id`
- `import_source = 'imported'`

This allows operators to trace where a template came from without leaking content across tenants.

