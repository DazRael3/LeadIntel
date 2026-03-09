## Purpose

LeadIntel’s benchmarking layer provides **bounded, explainable comparative guidance** without cross-tenant leakage.

This system is designed to answer operational questions like:

- Are we following through quickly on “ready” actions?
- Are prepared handoffs actually getting delivered?
- Which signal-family playbooks are seeing healthy completion in our workspace?
- Do we have enough evidence to compare to broader anonymized norms?

It is **not** designed to provide “market intelligence,” per-company comparisons, or claims about guaranteed outcomes.

## What we benchmark today

Current implementation (v1) is anchored on **workflow operations metadata**:

- `api.action_queue_items`: operational queue items and their statuses (`ready`, `delivered`, `blocked`, `failed`, etc.)
- `api.approval_requests`: approval throughput when the feature is used
- `api.outcome_records`: user-entered outcomes (used cautiously; often sparse)

Comparisons can be:

- **Workspace-only** (your data)
- **Prior period** (your workspace now vs your workspace before)
- **Cross-workspace anonymous norms** (only when privacy thresholds are met; aggregated, thresholded, and anonymized)

## Key surfaces

- **Team dashboard**: `/dashboard/benchmarks`
- **Account detail**: peer-pattern insight card on account pages
- **Governance**: `/settings/benchmarks`

## Output style (bounded)

Benchmarks and patterns are expressed as:

- **Bands**: below norm / within norm / above norm / insufficient evidence
- **Ranges** (coarsened): e.g., “30–45%” rather than precise percentiles
- **Confidence labels**: limited / usable / strong
- **Limitations notes** that explain what’s missing or why suppression occurred

## Network effects (privacy-safe)

Cross-workspace norms are built from aggregated workflow metadata only:

- never account lists
- never domains/company names
- never generated messaging bodies
- never per-workspace identifiable slices

See `docs/BENCHMARK_PRIVACY_MODEL.md` for the guardrails.

