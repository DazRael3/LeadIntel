# Workflow → outcome linkage (bounded)

Workflow-to-outcome linkage in LeadIntel is a **timing-based support view**. It helps teams answer:

- “What did we do first?”
- “What downstream CRM observation did we record later (if any)?”
- “Is this link verified, possible, ambiguous, or insufficient?”

It does **not** claim causality.

## Inputs used

- LeadIntel workflow:
  - `api.action_queue_items` (prepared/delivered actions)
  - `api.action_deliveries` (delivery history; account inferred from `meta.leadId` when present)
  - `api.outcome_records` (manual outcomes)
- Downstream CRM context:
  - `api.crm_object_mappings`
  - `api.crm_opportunity_observations`

## Output model

The API returns:

- **workflow events**: ordered events with timestamps
- **downstream events**: ordered CRM observations with timestamps
- **timing summary**: bounded, human-readable comparison
- **ambiguity note**: explicit multi-touch uncertainty when applicable
- **limitations note**: clear statement that this is support evidence only

## Timing windows

The linkage uses a **bounded window** (7–90 days), controlled by workspace policy:

- `policies.revenueIntelligence.defaultLinkageWindowDays`

## Notes on ambiguity

Linkage can be ambiguous due to:

- multiple touches across tools
- incomplete timeline events
- downstream observations predating the workflow window

In these cases, LeadIntel will label results as **ambiguous** or **insufficient** rather than forcing a narrative.

