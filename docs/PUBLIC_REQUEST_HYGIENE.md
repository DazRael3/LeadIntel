# Public request hygiene

Goal: public and informational routes must be **safe for anonymous users** and must remain clean when viewed by logged-in users.

## Rules

### 1) Do not mount auth-only mutations on public pages
- Avoid POSTing to authenticated endpoints (e.g. `/api/settings`) just to “stamp” a view.
- If a page needs user-specific state, prefer:
  - **read-only** calls that are safe when unauthenticated, or
  - explicit user actions (save buttons) that run only after intent.

### 2) Be careful with prefetch to auth-gated routes
Next.js `Link` prefetch can create noisy aborted requests when links point to auth-gated surfaces from public pages.

Use `prefetch={false}` for links like:
- `/login?...`
- `/signup?...`
- `/dashboard`
- `/settings/*`

Keep prefetch enabled for primary public navigation where it improves UX and does not generate auth noise.

### 3) Prefer analytics for view tracking
Use existing analytics utilities (e.g. `PageViewTrack`, `track(...)`) for page view events.
Do **not** couple view tracking to settings mutations.

