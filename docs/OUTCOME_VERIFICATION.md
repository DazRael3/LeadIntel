# Outcome verification workflows

LeadIntel supports human verification for CRM linkage and workflow→outcome interpretation.

## What gets verified

- CRM mappings (`crm_mapping`)
- CRM opportunity observations (`opportunity_observation`)
- Workflow→outcome links (`workflow_outcome_link`)

## Verification decisions

- `verified`
- `ambiguous`
- `not_linked`
- `needs_review_later`

Each review can include a short evidence note (sanitized, no secrets).

## Storage

- `api.revenue_verification_reviews`
  - reviewer identity (`reviewed_by`)
  - timestamp (`reviewed_at`)
  - target type + id
  - status + note

For CRM mappings, verification decisions are mirrored into:

- `api.crm_object_mappings.verification_status`

This supports a clean verification queue without complex joins.

## Access control

- RLS: workspace-scoped.
- API enforcement: verification write operations require elevated role (owner/admin/manager) **and** workspace policies must enable verification workflows.

