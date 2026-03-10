# Dashboard empty, partial, locked, and loading states

This page standardizes how dashboard states should look so Starter/preview users see a calm, premium experience.

## Principles
- Prefer **neutral** tones for “no data yet” and “locked”.
- Use **red** only for actionable, user-fixable hard failures.
- Never show “broken” placeholders (e.g. `-`) for key metrics.
- Locked states must **not** require the underlying module to mount or request data.

## Standard states

### No data yet
Use when the user is entitled, but there is nothing to display.
- Examples:
  - “No recent activity yet.”
  - “No visitors tracked yet.”
  - “Not enough signal data yet.”

### Locked (plan)
Use when the feature is real but not available on the current tier.
- Structure:
  - Title: “X is available on Closer/Team”
  - One-sentence explanation
  - Upgrade CTA that matches the required tier

### Unavailable (setup / environment)
Use when the feature is not configured in this environment/workspace.
- Examples:
  - “Visitor tracking is not configured in this environment.”
  - “This module is not available for this workspace yet.”
- Include:
  - “See plans” / “Contact support” as secondary paths (avoid raw API/debug routes)

### Loading
Use short, calm text (no “error red”) until you know it’s a hard failure.
- Examples:
  - “Loading…”
  - “Loading activation…”

