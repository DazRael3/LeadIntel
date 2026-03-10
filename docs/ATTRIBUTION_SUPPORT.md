# Attribution support (not attribution)

LeadIntel provides **bounded attribution support summaries** to help operators understand whether there is *downstream evidence* after LeadIntel workflow activity.

This is deliberately not an attribution suite:

- no “we caused pipeline” language
- no sole-touch credit
- no numeric confidence percentages

## Labels

LeadIntel uses bounded labels:

- **verified downstream support**
  - verified mapping + workflow activity + downstream observation exist
- **plausible support**
  - workflow activity + downstream observation exist, but mapping is not verified
- **ambiguous support**
  - mapping or timeline ambiguity is present
- **no verified support yet**
  - workflow activity exists, but there is no downstream observation recorded yet
- **insufficient CRM data**
  - no mapping exists, or revenue intelligence is disabled

## What is “verified” here?

“Verified” means a workspace user **explicitly verified the linkage** via the verification workflow.

Verification is stored in:

- `api.revenue_verification_reviews`
- and mirrored into `api.crm_object_mappings.verification_status` for queueing

## How to use this

- Treat it as **workflow measurement support**, not causal proof.
- Use it to spot:
  - where follow-through exists but downstream evidence is missing
  - where mapping coverage is thin
  - where verification backlog is growing

