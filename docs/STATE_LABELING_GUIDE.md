# State labeling guide (previews vs saved assets)

LeadIntel uses consistent terminology across the app to avoid user confusion.

## Core labels

- **Preview**: a limited/free-tier generation result that may be blurred/redacted and may not be reusable.
- **Saved report**: a report stored in `user_reports` (e.g. competitive reports).
- **Account brief**: a saved report of kind `account_brief` (stored in `user_reports`).
- **Tracked account**: a lead/account stored in `leads` (targets the user is monitoring).

## Usage meter language

When the user is on Starter:
- “Free plan: 3 preview generations total”
- “Usage is shared across pitches and reports”
- “Full premium content stays locked until you upgrade”

## Where to be careful

- Dashboard: never imply saved history is accessible on Starter if it is gated.
- Reports hub: show “No reports yet” without suggesting nonexistent artifacts.
- Pitch surfaces: if blurred, label as preview and keep upgrade CTA calm.
- Account workspace cards: recommendations are labeled as heuristic; intent is shown only when it exists.

