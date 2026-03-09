# Source registry

LeadIntel uses a typed source registry to describe:

- what sources exist in this repo
- what each source can do (capabilities)
- how each source is governed (non-claimy notes)
- whether a source is active/configurable/limited/unavailable

The registry is **not** a marketplace claim. It is an internal catalog for operational truth.

## Files

- `lib/sources/types.ts`
- `lib/sources/registry.ts`
- `lib/services/source-catalog.ts`
- Settings UI: `/settings/sources`

## Runtime status

Runtime status is intentionally limited to:

- booleans like “configured”
- non-secret notes

It never returns secret values.

