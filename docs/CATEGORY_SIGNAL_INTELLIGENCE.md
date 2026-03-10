## What category signal intelligence is

Category signal intelligence is a **bounded, operational summary** of which *signal families* appear most associated with successful follow-through in your usage.

It is **not**:

- a market intelligence report
- an industry benchmark
- a prediction engine

## Implementation (v1)

Current v1 is **workspace-only**:

- it looks at recent action queue items that include `payload_meta.playbookSlug`
- it summarizes which signal-family playbook proxies show healthier completion in your workspace

If your workspace has limited evidence, the UI clearly marks it as limited and does not overclaim.

## Why “playbookSlug” is used

LeadIntel does not store or share customer messaging content across tenants.

Instead, category signal intelligence uses a coarse proxy:

- the top signal family mapped into a use-case playbook slug (funding, hiring spike, product launch, partnership, expansion signals)

This yields a stable, non-identifying category key without exposing customer data.

