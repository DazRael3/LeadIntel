# Territory and segment logic (bounded)

LeadIntel supports a lightweight territory/grouping model to help with routing and coverage.

## What it supports

Territory rules can match:

- domain exact (`acme.com`)
- domain suffix (`.co.uk` style suffixes; stored as `co.uk`)
- tag matches (best-effort; tags are user-scoped in this repo)

Rules are ordered by `priority` (lower runs first).

## What it does not claim

- no CRM territory sync
- no geo intelligence
- no whitespace engine

## Storage

- `api.territory_rules`

## API

- `GET/POST/PATCH/DELETE /api/workspace/territories`

## UI

- `/settings/territories`

