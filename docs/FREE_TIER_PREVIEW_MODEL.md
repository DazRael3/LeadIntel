# Free tier preview model

## Rule (what Free includes)

- **Starter: 3 pitch previews + 3 report previews**
- **Limits are tracked separately (pitch vs report).**
- **Full premium content stays locked until you upgrade.**

## What users should expect

- A preview generation can succeed (and count) even when the full premium output is locked.
- Free users will see **preview-safe text** (server-trimmed) and locked UI.
- Paid users see full content normally.

## Reports hub flow

- The single landing page for reports is `/competitive-report`.
- Links can include `auto=1` and prefill keys like `company`, `url`, and `ticker` to trigger generation and then open the saved report.

## Why reports list stays “reports only”

Pitch previews are not reports and should not be shown in the reports list. Cross-surface preview usage is explained via **Recent premium activity** instead of inserting incorrect rows into the reports table.

