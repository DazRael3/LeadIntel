# Plan gating for actions and integrations

This repo enforces integrations and workflow orchestration features **server-side**.

## Current enforcement

- **Integrations settings** (`/settings/integrations`) requires **Team plan** (`requireTeamPlan`).
- **Workspace action queue** (`/dashboard/actions`) requires **Team plan**.
- **CRM and Sequencer handoff APIs** require **Team plan**.
- **Workspace defaults + recipes** require:
  - Team plan
  - workspace role `owner|admin`

## Why this matters

These features deliver data to external systems (webhooks/exports). They must be:

- permissioned
- inspectable
- safe (no secrets / no accidental leakage)

## UI behavior

When an action is not available, the UI:

- shows a calm “Team feature” message
- routes to pricing (`/pricing?target=team`)

