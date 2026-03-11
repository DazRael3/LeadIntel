# Visual elevation plan (minimal-churn)

This repository already has a distinctive dark “professional terminal” identity. The goal of this pass is **elevation, not redesign**: calmer hierarchy, clearer grouping, and better surface depth across the public site and logged-in shell.

## Principles
- **Premium + legible**: fewer screaming accents; more spacing, rhythm, and contrast discipline.
- **One system**: shared primitives (`Card`, `Button`, `Badge`) and shared wrappers (`MarketingPage`) should carry most of the lift.
- **Operationally truthful**: no invented proof, no new claims, no “enterprise theater”.
- **Minimal churn**: prefer token-level and wrapper-level improvements over page rewrites.

## What “good” looks like
- **Background**: the terminal grid is present but subtle (texture, not a feature).
- **Surfaces**: cards feel layered and readable; borders are quiet; shadows are restrained.
- **Accent**: cyan glow is used intentionally for primary moments; it should not dominate every heading.
- **Rhythm**: sections have consistent spacing; separators are light; CTAs are grouped.

## Implementation approach
- **Design tokens first**: adjust CSS variables and utility classes used everywhere.
- **Primitives second**: tune `Card`/`Button`/`Badge` base styles to reduce border/noise.
- **Wrappers third**: improve shared marketing wrappers to lift many pages at once.
- **Page-level last**: only targeted spacing/CTA grouping on high-traffic pages (homepage, pricing).

## Current scope (this elevation wave)
- Foundation: `app/globals.css` + UI primitives
- Public conversion: homepage and pricing composition (spacing/hierarchy only)
- Public consistency: marketing page wrapper spacing

## Deferred on purpose
- A full “new design system” abstraction layer (not needed for this pass)
- Rewriting marketing copy or adding new sections
- Introducing new illustration/hero systems
- Reworking logged-in IA beyond the existing “More” grouping and dashboard cleanup

