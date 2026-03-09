# Upgrade conversion system (calm + consistent)

LeadIntel’s upgrade surfaces are designed to:
- clarify what’s locked vs unlocked
- explain *why* upgrading matters for daily execution
- avoid dark patterns (no countdowns, no modal loops)
- preserve security and entitlement enforcement (server-side)

## Plan framing (copy system)

- **Starter (Free)**: Preview the workflow
- **Closer**: Run daily outbound with full visibility
- **Closer+**: Deeper context and refresh/regenerate capability
- **Team**: Standardize and scale shared workflow

## Where upgrade callouts appear

- Locked previews (blurred sections)
- Free generation limit reached (shared across pitches + reports)
- Dashboard activation rail (Starter-only, conditional)
- Team-only workflow gates (templates, webhooks/exports)
- Action center premium actions (brief saving, variants, exports/webhooks depending on tier)

## Shared components

- `components/billing/UpgradeExplainer.tsx`
  - consistent “why upgrade” explanation block
  - supports reason-specific framing (`free_limit_reached`, `locked_preview`, `team_workflow`, etc.)

- `components/billing/UpgradeComparisonDrawer.tsx`
  - lightweight plan comparison (no fabricated enterprise claims)

- `components/billing/PlanValueCallout.tsx`
  - reusable “value callout” card used on dashboard rails

## Enforcement principles

- **Server-side gating** stays authoritative (routes return `403`/`429` where appropriate).
- UI never reveals locked content to free users (previews are blurred/redacted).
- Analytics events **never** include generated outreach text, report content, or sensitive payloads.

