# UI cleanup plan (shell + dashboard + public polish)

This is a **simplification and organization pass**, not a redesign.

## Goals
- Reduce “everything is equally loud” in navigation and dashboard chrome
- Improve scan-ability and primary/secondary hierarchy
- Make Starter/preview feel calm and intentional
- Keep paid paths deep, but less noisy

## Scope (high ROI)
- Logged-in header + mobile menu
- Dashboard header strip + metrics bar
- Dashboard tab rail and Command Center ordering
- Light public-nav/footer tidy only when needed

## Key decisions
- Logged-in header: keep **4 primary destinations** visible; group the rest under **More**
- Dashboard: make the top screen answer “what should I do next?” in one glance
- Starter: fewer tabs + fewer mounted modules; locked states never mount requestful components

