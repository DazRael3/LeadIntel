# Planning governance

Workspace admins can control planning intelligence surfaces without “AI theater.”

## Controls

Configured in:

- `/settings/planning-intelligence`

Policy keys:

- `planning.planningIntelligenceEnabled`
- `planning.teamInfluenceSummariesEnabled`
- `planning.outcomeInformedPlanningEnabled`

## Enforcement

Planning endpoints enforce these flags server-side. When disabled, APIs return a restricted response and UI cards do not render meaningful content.

## Audit

Policy updates are audited as `workspace.policy_updated` (no sensitive payloads).

