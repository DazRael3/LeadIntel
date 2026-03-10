# API object model

Platform API responses return stable “platform objects” where appropriate.

Each object follows:

- `id`: stable identifier
- `object`: type string
- `workspace_id`: workspace scope
- `created_at` / `updated_at`: timestamps where relevant
- `attributes`: safe, typed fields for developers

The core types live in:

- `lib/platform-api/objects.ts`
- `lib/platform-api/serializers/*`

## Objects currently exposed (v1)

- `workspace`
- `account` (workspace program account)
- `action_queue_item`
- `delivery_event`
- `benchmark_summary` (summary-safe metrics)

## Redaction policy

Platform objects are **metadata-first**. They do not return raw generated markdown/email bodies.

