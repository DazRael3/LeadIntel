## Non-negotiable goals

LeadIntel benchmarking must be:

- **privacy-safe**
- **aggregated + anonymous across tenants**
- **thresholded (k-anonymity style)**
- **explainable and bounded**
- **suppressing output when eligibility is not met**

## What we never expose

- Another customer’s accounts, domains, or identifiers
- Another workspace’s raw outcomes or delivery histories
- Any benchmarking of messaging bodies across tenants
- Narrow cohorts that can be reverse engineered
- Raw counts or slices when cohort eligibility is unsafe

## Guardrails in code

Implementation modules:

- `lib/benchmarking/privacy.ts`: thresholds + eligibility rules
- `lib/services/privacy-safe-aggregation.ts`: calls server-only RPCs and coarsens outputs
- `supabase/migrations/0055_privacy_safe_benchmark_rpcs.sql`: security definer RPCs (service-role only)

### Threshold model (v1)

Hard thresholds (subject to change via versioning):

- **Minimum cohort workspaces**: `10`
- **Minimum total events** (workflow norms): `200`
- **Minimum bucket events** (peer buckets / playbooks): `80`

If these thresholds are not met:

- cross-workspace outputs are **suppressed**
- UI shows a calm “insufficient evidence” state
- the system falls back to workspace-only / prior-period comparisons when available

## Cross-workspace computation boundaries

Cross-workspace norms operate only on operational metadata:

- `api.action_queue_items.status`
- `api.action_queue_items.payload_meta.patternBucket` (broad bucket key)
- `api.action_queue_items.payload_meta.playbookSlug` (signal-family proxy)
- `api.outcome_records.outcome` (only for high-level aggregates; often sparse)

No message bodies, company identifiers, or account lists are used.

## Why we use RPCs (and why they’re service-role only)

RLS prevents cross-workspace reads for normal clients. To enable privacy-safe norms without leaking:

- aggregation runs in **security definer** functions that return **only aggregated results**
- execution is **revoked from `public`** and granted only to `service_role`
- application routes enforce **Team plan gating** and workspace policy toggles

## “Eligible cohort” meaning

An “eligible cohort” means:

- enough distinct workspaces contributed to the aggregate
- enough total events exist to prevent reverse engineering
- the output can be shown without exposing other tenants

If not eligible, we do not “fill in” insights.

