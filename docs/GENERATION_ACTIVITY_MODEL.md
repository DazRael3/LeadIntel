# Generation activity model

## Purpose

The product has two different (related) concepts:

- **Usage enforcement** (Free preview cap: 3 total across pitches + reports)
- **Activity visibility** (help users understand where their usage went)

Usage and activity must remain truthful:

- Do **not** create fake “reports” from pitch previews.
- Do **not** count failed/blocked attempts.

## Current implementation

- **Reports list**: derived from persisted report rows (e.g., `api.user_reports` with `report_kind='competitive'`).
- **Recent premium activity**: derived from real persisted generation artifacts:
  - pitch generations from `api.pitches` (joined to `api.leads` for company context)
  - report generations from `api.user_reports` (competitive, complete)

## API surface

- `GET /api/usage/premium-generations`: returns capabilities + shared usage.
- `GET /api/usage/premium-activity`: returns recent pitch/report activity for visibility.

