# Closed-loop CRM intelligence (bounded)

LeadIntel’s closed-loop revenue intelligence is **explicit, workspace-scoped, and verified by humans**. It helps teams connect:

- **LeadIntel workflow activity** (handoffs, deliveries, outcomes)
- to **downstream CRM observations** (entered as observations + verified linkage)

It is intentionally **not** a pipeline attribution engine and does not claim causality.

## What exists in this repo

- **CRM mappings** (`api.crm_object_mappings`)
  - Explicit links between a LeadIntel account (`api.leads`) and an external CRM object id (system=`generic`).
- **Opportunity observations** (`api.crm_opportunity_observations`)
  - Workspace-entered observations of opportunity stage/status with timestamps and optional evidence notes.
- **Verification reviews** (`api.revenue_verification_reviews`)
  - Auditable reviewer decisions: verified / ambiguous / not linked / needs review later.

## What LeadIntel surfaces

- **Opportunity context**: shows whether a mapping exists and the latest recorded downstream observation.
- **Workflow → outcome link**: shows a bounded timeline comparison (workflow events vs downstream observation timing).
- **Attribution support**: bounded support labels (verified/plausible/ambiguous/none) with explicit limitations.
- **Verification dashboard**: reviewer workflow to mark or correct linkage status.
- **CRM linkage health**: mapping/verification coverage summary (not a live-sync health dashboard).

## What LeadIntel does *not* claim

- No “we caused revenue” language.
- No automatic CRM sync in this wave.
- No “deal created” claims unless a downstream observation is explicitly recorded.
- No numeric attribution confidence percentages.

## Related docs

- `docs/CRM_OBJECT_MAPPINGS.md`
- `docs/WORKFLOW_OUTCOME_LINKAGE.md`
- `docs/ATTRIBUTION_SUPPORT.md`
- `docs/OUTCOME_VERIFICATION.md`
- `docs/OBSERVED_VS_INFERRED_REVENUE.md`
- `docs/REVENUE_GOVERNANCE.md`

