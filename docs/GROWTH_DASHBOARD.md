# Growth dashboard

The Growth dashboard (`/dashboard/growth`) is an **internal, Team-plan** operator surface that shows:

- **Growth event counts** (directional, windowed)
- **Experiment exposures** (deduped per user/unit)
- **Directional experiment results** (counts by variant for instrumented metrics)
- **Lifecycle and retention heuristics** (bounded; not churn prediction)

## Data sources

- `api.experiment_exposures` (deduped)
- `api.growth_events` (sanitized allowlist)

## Interpretation rules

- Treat results as **directional operational signals**.
- If sample sizes are low or event volume is noisy, do not call a “winner.”
- Prefer rolling out changes only when:
  - the change is low-risk,
  - the effect is consistent across multiple windows,
  - there is no regression in secondary guardrail metrics.

