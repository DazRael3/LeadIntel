# Packaging model (truthful, code-backed)

This document describes **what each plan unlocks** based on **code-level gating** in this repo.

## Source of truth

- Tier resolution: `lib/billing/resolve-tier.ts`
- Team gating: `lib/team/gating.ts` (`requireTeamPlan`, `getUserTierForGating`)
- Free preview generations: `lib/billing/premium-generations.ts`
- UI usage meter: `components/billing/UsageMeter.tsx`

## Plans (conceptual)

### Starter (Free)

- **Free plan: 3 preview generations total**
- **Usage is shared across pitches and reports**
- **Full premium content stays locked until you upgrade**

Enforced via:
- `FREE_MAX_PREMIUM_GENERATIONS = 3` and `usage_events` ledger
- Server-side redaction + locked preview rendering

### Closer

Purpose: daily prioritization and faster execution.

Unlocks:
- Full pitch/report access (no free cap)
- Daily shortlist + explainable scoring surfaces

### Closer+

Purpose: deeper operator context.

Unlocks:
- Closer features
- Sources & freshness visibility and refresh/regenerate workflow for competitive reports (where enabled)

### Team

Purpose: governance and rollout.

Unlocks:
- Shared templates with approvals
- Audit logs
- Webhooks + exports
- Team settings surfaces (`/settings/*`) and admin workflows

## Important boundaries

LeadIntel does not claim:
- SOC 2 / ISO 27001
- SSO/SAML/SCIM
- universal contact coverage
- full CRM replacement

Only claim what is directly evidenced in product and code.

