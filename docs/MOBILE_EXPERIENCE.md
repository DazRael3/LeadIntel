# Mobile experience (web)

LeadIntel is a responsive web app (not a native mobile app). Mobile UX focuses on **fast skim-to-action** without squeezing dense desktop layouts onto small screens.

## What exists

- **Mobile navigation menu**: `components/navigation/MobileNavMenu.tsx`
  - Provides workspace context + key routes on small screens.
- **Mobile shortlist (daily review)**: `components/mobile/MobileShortlistView.tsx`
  - Embedded on the Dashboard “Command Center” tab for small screens.
  - Summary is derived from `/api/team/planning` (workflow activity).
- **Mobile account triage**: `components/mobile/MobileAccountTriage.tsx`
  - Embedded inside `components/LeadDetailView.tsx` on small screens.
  - Presents a compact signals/freshness view + quick copy actions.
- **Mobile approvals review**: `/dashboard/approvals`
  - Mobile-first queue cards + bottom-sheet review (comments + decision).

## Design rules

- Prefer stacked cards (`md:hidden` vs `hidden md:block`) over horizontal scrolling.
- Keep tap targets >= ~40px height for primary actions.
- Expandable reasoning is allowed; default view must stay compact.
- Do not expose locked/premium message bodies via collapsed/condensed content.

