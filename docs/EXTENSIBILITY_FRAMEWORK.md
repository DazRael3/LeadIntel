# Extensibility framework (custom actions)

LeadIntel supports a bounded “extensions” model intended for **safe, operator-configured custom actions**.

## What a custom action is

A custom action is:

- workspace-scoped
- webhook-delivered
- configured with a validated JSON payload template
- enabled/disabled via governance
- audited when created/executed

## Storage

Custom actions are stored in:

- `api.custom_actions` (migration `0059_platform_extensions_custom_actions.sql`)

## Template variables (allowlist)

Templates support `{{var}}` substitutions and are validated against an allowlist:

- `account.id`
- `account.name`
- `account.domain`
- `account.program_state`
- `account.lead_id`
- `workspace.id`
- `computedAt`

Validation and rendering:

- `lib/extensions/validators.ts`
- `lib/extensions/runtime.ts`

## Governance

Extensions are gated by workspace policy:

- `policies.platform.extensionsEnabled`

UI:

- `/settings/extensions`
- `/settings/platform`

