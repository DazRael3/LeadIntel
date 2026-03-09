# Experiment interpretation

LeadIntel’s experiment reporting is intentionally **conservative**.

## What the system shows today

- **Exposures** (deduped): how many unique units saw a variant
- **Directional metric counts**: event counts for instrumented metrics by `experimentKey` + `variantKey`

## What the system does not do (by default)

- No automatic statistical significance testing
- No “winner” selection automation
- No claims of uplift or causality

## Practical guidance

Use this as an operational dashboard:

- If the **primary metric count** is meaningfully higher for a variant *and* secondary guardrails don’t degrade, consider rolling out gradually.
- If results are noisy or sample sizes are small, keep running or revert to control.
- Keep notes in the experiment definition so future operators understand why the test existed.

