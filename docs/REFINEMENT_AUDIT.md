# Refinement audit (platform polish framework)

This repo maintains a structured refinement audit to prevent “feature-rich but uneven” drift.

The audit is:
- **Grounded in real code** (registries, copy system coverage, core surface inventory)
- **Operational** (meant to drive small patches)
- **Truthful** (no aspirational claims in the audit output)

## Where the audit lives

- Audit logic: `lib/refinement/audit.ts`
- Gap category taxonomy: `lib/refinement/gap-categories.ts`
- Admin board UI: `app/admin/refinement/page.tsx` (ADMIN_TOKEN gated)

## What the audit tracks

Categories are intentionally broad so the board stays stable over time:

- copy inconsistency
- CTA inconsistency
- empty/loading/error states
- mobile responsiveness gaps
- permission/gating confusion
- stale terminology
- trust/copy overstatement risk
- route continuity
- edge-case handling
- table/filter consistency
- action confirmation consistency
- assistant/help mismatch
- visual hierarchy
- vertical/use-case copy gaps

## How to use it

1) Visit the admin page (requires `ADMIN_TOKEN`):
- `/admin/refinement?token=...`

2) Convert “warn” items into concrete bug-bash entries:
- link to route
- describe the broken/misaligned state
- confirm the correct behavior (no new claims)

3) Close items with small PRs:
- prefer reusable primitives (copy/state wrappers) to one-off copy edits
- ensure changes are covered by unit/E2E tests when user-facing

## Non-goals

- This is not a replacement for GitHub issues.
- This does not auto-scan the repo filesystem in production.
- This does not invent “vertical readiness” or proof that doesn’t exist.

