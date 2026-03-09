# Observed vs inferred (revenue intelligence)

LeadIntel separates:

- **Observed (LeadIntel)**: events that happened inside the product (handoff prepared, delivery queued, outcome recorded).
- **Observed (CRM)**: downstream observations recorded in LeadIntel (opportunity stage/status at a timestamp).
- **Verified linkage**: a workspace user explicitly verified the mapping or linkage.
- **Inferred support**: timing-based support signals (workflow happened before a downstream observation) without causal claims.

## What “observed CRM” means in this repo

In this wave, “CRM observed” means:

- the workspace recorded a CRM observation via `api.crm_opportunity_observations`
- it may be sourced manually (not a live integration sync)

This avoids overstating coverage or claiming the CRM system-of-record was queried.

## What is intentionally not inferred

- No revenue attribution.
- No “this touch created that opportunity.”
- No sole-touch credit.
- No “deal won because of LeadIntel.”

When evidence is thin or multi-touch ambiguity exists, LeadIntel keeps labels as:

- ambiguous
- possible
- insufficient evidence

