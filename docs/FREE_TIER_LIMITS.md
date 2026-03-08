# Free tier limits (premium generations)

## Rule (production)

**Free (Starter) users can complete a maximum of 3 total premium generations** across:

- **Generated pitches**
- **Generated reports** (competitive reports; other report kinds may also count when marked as premium generation)

This is a **combined cap** (not 3 each).

After the 3rd successful generation is recorded, additional generation requests are blocked until upgrade.

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

All generation routes enforce the cap server-side. When the free cap is reached, routes return:

- **HTTP 429**
- `error.code = "FREE_TIER_GENERATION_LIMIT_REACHED"`
- `error.details.usage = { used, limit, remaining }`
- `error.details.upgradeRequired = true`

## Blur / leakage prevention

Free users may still use the free experience, but **premium sections remain locked**:

- Generation endpoints return **redacted** payloads for Free (no full premium text in JSON).
- Viewer endpoints/pages use **preview-safe excerpts**.
- Copy/download actions operate on **preview-safe text only** for Free.

## How to verify

1) Sign in as a Free (Starter) user.
2) Generate 3 total assets across pitch/report.
3) Attempt a 4th generation:
   - should return `FREE_TIER_GENERATION_LIMIT_REACHED` (429)
4) Confirm responses for Free do **not** include full premium text.

