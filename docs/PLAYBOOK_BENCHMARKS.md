## What playbook benchmarks are

Playbook benchmarks provide **bounded, operational guidance** for approved/use-case playbooks:

- workspace-only completion signals (prepared → delivered)
- privacy-safe typical ranges (when cross-workspace norms are eligible)

They do **not** claim:

- win rates
- per-industry performance
- per-tenant comparisons
- messaging effectiveness across customers

## Data used (v1)

Playbook benchmarks use action queue metadata only:

- `api.action_queue_items.status`
- `payload_meta.playbookSlug` (a signal-family proxy derived from top signal type)

## Output behavior

Each playbook row includes:

- evidence type: workspace-only / cross-workspace anonymous / insufficient evidence
- bounded completion range (coarsened)
- confidence label (limited/usable/strong)
- refresh timestamp + version

If cross-workspace eligibility is not met, the typical range is suppressed.

