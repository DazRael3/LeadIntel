# Free tier preview limits (premium generations)

## Rule (production)

**Starter users can complete a maximum of 3 pitch previews and 3 report previews**:

- **Generated pitches**
- **Generated reports** (competitive reports; other report kinds may also count when marked as premium generation)

These limits are tracked **separately** (not a combined cap).

## Reports hub (single landing page)

- **All report entry points should land on** `/competitive-report`.
- To auto-generate a report (prefilled from pitch/company context), use:
  - `/competitive-report?auto=1&company=...&url=...&ticker=...`
- The hub will generate (if `auto=1` and no `id`) and then redirect to:
  - `/competitive-report?id=<reportId>`

After the 3rd successful generation of a given type is recorded, additional requests of that type are blocked until upgrade.

## What counts

A generation is counted **only when it successfully completes** and is recorded as a completed premium generation event:

- Pitch generation: counted after the pitch is successfully persisted.
- Report generation: counted after the report is successfully persisted.

## What does not count

- Validation errors (400)
- “No sources found” (422)
- Internal/server errors (5xx)
- Cancelled/failed attempts
- Viewing/reopening previously saved outputs

## Enforcement (server-side)

All generation routes enforce caps server-side. When a Starter cap is reached, routes return:

- **HTTP 429**
- `error.code = "FREE_TIER_GENERATION_LIMIT_REACHED"`
- `error.details.usage = { used, limit, remaining }`
- `error.details.upgradeRequired = true`

## Preview-only + blur / leakage prevention

Free users can generate previews, but **full premium content stays locked**:

- Generation endpoints return **redacted** payloads for Free (no full premium text in JSON).
- Viewer endpoints/pages use **preview-safe excerpts**.
- Copy/download actions operate on **preview-safe text only** for Free.

## Why pitch previews do not appear in the reports list

- The **Reports** list contains **reports only** (e.g., competitive reports).
- Pitch previews consume shared preview usage, but they are not reports and should not be surfaced as saved reports.
- The Reports page includes a separate **Recent premium activity** panel to explain cross-surface usage.

## How to verify

1) Sign in as a Free (Starter) user.
2) Generate 3 pitch previews, then attempt a 4th pitch preview:
   - should return `FREE_TIER_GENERATION_LIMIT_REACHED` (429)
3) Generate 3 report previews, then attempt a 4th report preview:
   - should return `FREE_TIER_GENERATION_LIMIT_REACHED` (429)
4) Confirm Starter responses do **not** include full premium text.

