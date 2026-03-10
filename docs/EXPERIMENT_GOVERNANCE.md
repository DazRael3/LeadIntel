# Experiment governance

Experiments are controlled by **workspace policies** (Team plan).

## Policies

Stored in `api.workspace_policies` and surfaced via `/settings/experiments`:

- `policies.growth.experimentsEnabled`
- `policies.growth.exposureLoggingEnabled`
- `policies.growth.manageRoles`
- `policies.growth.viewerRoles`
- `policies.growth.protectedSurfaces`

## Enforcement

- Experiment evaluation is blocked when experiments are disabled.
- Experiment evaluation is blocked when a requested surface is not allowlisted or is protected.
- Exposure logging is deduped per unit and is best-effort.

## Safety expectations

- Prefer copy/layout tests.
- Start at low rollouts.
- Use kill switches when anything feels unstable.
- Never run experiments on entitlements, billing, permissions, or security/trust surfaces.

