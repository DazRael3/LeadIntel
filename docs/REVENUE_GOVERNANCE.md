# Revenue intelligence governance

Revenue intelligence is controlled via workspace policies under:

- `policies.revenueIntelligence`

## Controls

- `revenueIntelligenceEnabled`
  - Enables CRM linkage context and closed-loop surfaces.
- `attributionSupportEnabled`
  - Enables bounded “support” labels (never causal).
- `verificationWorkflowsEnabled`
  - Enables the verification workflow (reviewer actions).
- `ambiguousVisibleToViewerRoles`
  - When disabled, ambiguous cases should be handled by verifiers; surfaces still avoid overclaiming.
- `defaultLinkageWindowDays`
  - 7–90 day window for linkage comparisons.

## Roles

Policies include:

- `viewerRoles`: who can view revenue intelligence surfaces
- `verifierRoles`: who can record verification decisions

All checks are enforced server-side.

## What governance does not do

- It does not enable or claim vendor SSO/SCIM.
- It does not create a CRM integration sync.
- It does not bypass entitlement or content redaction.

