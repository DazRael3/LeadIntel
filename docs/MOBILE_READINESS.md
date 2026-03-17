# Mobile Readiness (Production Notes)

LeadIntel is responsive by default, but we treat mobile as a **first-class runtime surface**. This doc captures the narrow, high‑ROI hardening work and what to validate on phones before shipping.

## Target widths
- **320px**, **360px**, **390px**, **430px**

## Core routes to validate
### Public
- `/`
- `/pricing`
- `/use-cases`
- `/compare`
- `/tour`
- `/trust`
- `/support`
- `/templates`
- `/how-scoring-works`

### Logged in
- `/dashboard`
- `/competitive-report`
- `/pitch`
- `/support`
- locked Team-only routes that appear via navigation

## What we hardened (high-signal)
- **Tap targets**: Mobile menu + key dashboard CTAs use a minimum comfortable height (`min-h-10`) for thumbs.
- **Mobile nav**: Starter users see a smaller, more usable menu (Team-only Actions is hidden; Support is always available).
- **Dashboard (Starter)**: First screen is shorter and more decisive (primary workflow first, checklist moved into the “Today / progress” row instead of competing side-by-side).
- **CTA stacking**: Dashboard header buttons stack cleanly on mobile (full-width on small screens).

## Common failure modes (what to watch for)
- Horizontal scroll caused by long button groups or tab rails
- Tiny tap targets (icon-only buttons, dense menu items)
- “Everything equal weight” layouts on Starter that hide the first next action
- Sticky headers that steal too much viewport height

