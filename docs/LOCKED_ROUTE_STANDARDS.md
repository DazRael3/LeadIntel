# Locked route standards (Team / paid-only)

Locked routes should feel **intentional and premium**, not empty or broken.

## Required structure

For any Team-only / paid-only route, the locked state must include:
- **H1** that matches the page name (e.g. “Integrations”, “Actions”, “Workspace”)
- **One-line subtitle** explaining what the page is for
- **Why it’s locked** (plan-bound explanation)
- **What unlocks it** (plan name)
- **One clear primary CTA** (upgrade target)
- Optional: a short bullet list of what you get (no overclaims)

## Implementation

Use `components/team/TeamUpgradeGate.tsx` with route-specific props:
- `heading`
- `subtitle`
- `whyLocked`
- `bullets`
- `primaryCtaHref` / `primaryCtaLabel`

This keeps the locked experience consistent while allowing each route to be specific and buyer-grade.

