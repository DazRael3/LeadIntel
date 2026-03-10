# Feature flags and rollouts

LeadIntel supports **safe progressive rollout** using the same primitives as experiments:

- **`rollout_percent`**: percentage gate (0–100) applied deterministically
- **`status`**: `draft` → `running` → `paused`/`completed` → `rolled_out`/`reverted`
- **`kill_switch`**: immediate disable regardless of rollout

## Two flag systems in the repo

1. **Operational kill switches** (`lib/services/feature-flags.ts`)
   - Env + per-user overrides (table: `api.feature_flags`)
   - Used for infra-level switches (e.g., webhooks, enrichment)

2. **Growth feature flags** (`lib/flags/*`)
   - Backed by `api.experiments` (variant convention: `on` enables, `control/off` disables)
   - Used for controlled UI/UX rollouts in non-critical surfaces

## Rollout guidance

- Start at **0–10%** and increase gradually.
- Prefer **copy/layout** changes over behavioral changes.
- Never roll out changes that affect:
  - entitlements and premium redaction
  - permission checks
  - billing amounts / checkout semantics
  - destructive actions

