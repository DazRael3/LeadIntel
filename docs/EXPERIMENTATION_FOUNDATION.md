# Experimentation foundation

LeadIntel’s experimentation system is designed to be **low-risk, auditable, and reversible**. It supports:

- **Workspace-scoped** experiments (per `api.workspaces`) with role-aware targeting.
- **Deterministic assignment** (stable per user/workspace unit).
- **Progressive rollout** via a `rollout_percent` gate.
- **Kill switch** per experiment (`kill_switch`).
- **Deduped exposure logging** (`api.experiment_exposures`) for operational reporting.

## What experiments can (and cannot) do

- **Allowed**: copy, layout emphasis, onboarding guidance, activation education, “what next” guidance.
- **Not allowed** (enforced by policy + allowlists): security/governance/entitlements/billing surfaces, or any logic that changes permissions, redaction, or checkout amounts.

## Key components

- **Persistence**
  - `api.experiments`: experiment definitions + rollout controls
  - `api.experiment_exposures`: deduped exposures by unit (user/workspace/session)
  - `api.growth_events`: sanitized, workspace-scoped event stream for growth ops

- **Evaluation**
  - `lib/experiments/engine.ts`: deterministic assignment with targeting + rollout + guardrails
  - `lib/experiments/assignment.ts`: hashing/bucketing utilities
  - `lib/experiments/guards.ts`: global enablement + protected-surface checks

## Enablement

Two gates must be satisfied for in-product experiments:

1. **Workspace governance**: `policies.growth.experimentsEnabled === true`
2. **Client enablement** (to avoid accidental fetches in environments not ready): `NEXT_PUBLIC_EXPERIMENTS_ENABLED=true`

## Exposure logging

When exposure logging is enabled (`policies.growth.exposureLoggingEnabled`), exposures are written (deduped) to `api.experiment_exposures`.

LeadIntel also emits a product analytics event (`experiment_exposed`) **without including sensitive payloads**.

