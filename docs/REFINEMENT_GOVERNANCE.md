# Refinement governance

Refinement is treated as product work with sustained operational ownership.

## What “governance” means here

- A stable taxonomy of polish gap categories (`lib/refinement/gap-categories.ts`)
- A repeatable audit snapshot (`lib/refinement/audit.ts`)
- An internal board for visibility (`/admin/refinement`, ADMIN_TOKEN gated)

## Workflow

- Capture specific instances as small items (route, screenshot, expected state).
- Fix via targeted patches (prefer shared primitives).
- Verify with unit/E2E tests for user-facing changes.

## Prohibited governance behavior

- No fake “enterprise readiness” claims.
- No silent behavioral changes in the name of polish.
- No “vertical specialization” additions unless backed by real product surfaces.

