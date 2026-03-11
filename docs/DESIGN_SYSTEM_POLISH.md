# Design system polish notes

This doc records the minimal-churn styling adjustments intended to make the UI feel calmer and more premium while preserving the “professional terminal” brand DNA.

## Tokens and utilities
- **Corner radius**: `--radius` increased slightly to reduce sharpness and improve modern feel.
- **Terminal grid**: reduced contrast and density so it reads as texture (not a foreground pattern).
- **Neon accents**: reduced glow intensity so accent is a focus tool rather than constant noise.

## UI primitives
### `Card`
- Default card surface uses a **quieter border** and a slightly softened background fill so nested grids don’t look like hard outlines everywhere.

### `Button`
- `outline` variant uses a **softer border** and a subtle background fill to read as a deliberate secondary action (not a hollow “wireframe” control).

### `Badge`
- Default badge typography is slightly calmer (`font-medium`).
- `outline` badge uses a soft border + light fill so it reads as an intentional label on dark surfaces.

## Usage guidelines
- Use **glow/neon** only for “primary path” CTAs (hero primary, plan primary, locked-to-upgrade primary).
- Prefer **outline/secondary** for navigation, cross-links, and secondary actions.
- Don’t stack multiple “loud” accents (neon text + glow button + neon border) in the same visual cluster unless it’s the single primary decision point on the screen.

