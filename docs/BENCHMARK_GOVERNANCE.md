## Benchmark governance

Benchmarking is governed by workspace policies and enforced server-side.

## Settings surface

- `/settings/benchmarks`

Controls:

- **Enable benchmarks**: disables benchmark dashboards and peer-pattern insights
- **Enable cross-workspace insights**: allows anonymized norms when privacy thresholds are met
- **Enable prior-period comparison**: allows workspace now vs prior comparisons
- **Viewer roles**: restricts who can view benchmark surfaces

## Enforcement points

Benchmark APIs validate:

- Team plan gating (`requireTeamPlan`)
- workspace membership
- `policies.benchmarks.benchmarksEnabled`
- `policies.benchmarks.viewerRoles` membership
- cross-workspace enabled flag before requesting anonymous norms

## Auditing

Benchmark settings updates are written via `/api/workspace/policies` which already logs `workspace.policy_updated` audit entries.

