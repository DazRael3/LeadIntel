# Platform system map (high level)

This document is a **map of real subsystems** in the repository to reduce drift and duplicate implementations.

## Core domains

- **Accounts and explainability**
  - `lib/data/getAccountExplainability.ts`
  - `lib/services/lead-scoring.ts`
  - `lib/services/source-health.ts`
  - `lib/services/data-quality.ts`
- **Workflow orchestration**
  - Action queue: `lib/services/action-queue.ts`
  - Deliveries: `lib/services/delivery-history.ts`
  - Webhooks: `lib/integrations/webhooks.ts`
  - Recipes: `lib/services/action-recipes.ts`
- **Governance and workspace controls**
  - Policies schema: `lib/domain/workspace-policies.ts`
  - Policy API: `app/api/workspace/policies/route.ts`
- **Closed-loop revenue intelligence (bounded)**
  - CRM mappings/verification: `lib/crm-intelligence/*`, `lib/services/*` (crm-linkage, verification)
  - Surfaces: `/settings/revenue-intelligence`, `/dashboard/verification`, `/dashboard/revenue-workflows`
- **Experimentation and growth ops**
  - `lib/experiments/*`, `/settings/experiments`, `/dashboard/growth`
- **Developer platform**
  - `lib/platform-api/*`, `/developers`, `/settings/api`, `/settings/platform`

## Sources and enrichment snapshots

- `lib/sources/*` implements a snapshot-based source bundle with TTL and citations.
- `lib/sources/registry.ts` is the truth registry for what exists (not a marketplace claim).

## Enablement (foundation)

- `lib/enablement/*`
- `/learn`

