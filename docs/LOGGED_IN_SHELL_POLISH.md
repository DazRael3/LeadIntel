# Logged-in shell polish guidelines

This doc captures the “cleaner shell” decisions so the dashboard and navigation stay calm, entitlement-aware, and premium.

## Navigation
- **Primary**: keep the main line of sight focused on the core workflow (dashboard and a small set of high-frequency destinations).
- **Progressive disclosure**: group power-user/admin surfaces under “More” and keep visibility role/plan-aware.
- **Starter/preview discipline**: don’t overwhelm Starter users with a full cockpit of advanced destinations.

## Dashboard first-screen hierarchy
For Starter (preview) users, the first screen should explain itself in seconds:
- **Account summary**: compact, truthful (tier + preview remaining/credits).
- **Key metrics**: small set, stable layout (avoid noisy tile rows).
- **Primary workflow**: one clear next step.
- **Locked/advanced**: show as intentional locked states (don’t mount modules that fire unauthorized requests).

## States and tone
- **Locked**: calm, explicit, and upgrade-targeted (no “broken” vibes).
- **Empty**: “no data yet” language with a next step.
- **Errors**: avoid toast spam; show errors only when actionable, and never leak internal/debug details.

## Visual restraint
- Fewer badges/pills at the top of the dashboard.
- Avoid stacking multiple accent treatments in one cluster (neon text + glow + outline + badges).

