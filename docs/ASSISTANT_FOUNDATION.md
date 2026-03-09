# Assistant foundation (conversational workflow layer)

LeadIntel’s assistant is a **tool-driven, workspace-scoped** conversational layer. It is designed to be:

- **Grounded** in real product objects (accounts, queue, approvals, executive summaries)
- **Permission-aware** (workspace role + workspace policies)
- **Non-autonomous** by default (no silent actions)
- **Auditable** when it executes a state-changing action (explicit confirmation)

This is not a generic chat app and not an “AI SDR”.

## What exists

### APIs

- `POST /api/assistant/chat`
  - Stores user + assistant messages to `api.assistant_messages`
  - Produces a structured answer with sources + suggested actions
- `GET /api/assistant/suggested-prompts`
- `GET/POST /api/assistant/threads`
- `POST /api/assistant/actions`
  - Supports **preview** (`confirm=false`) and **execute** (`confirm=true`)

### Persistence

Migration: `supabase/migrations/0060_assistant_threads_and_messages.sql`

- `api.assistant_threads` (workspace + target)
- `api.assistant_messages` (threaded conversation)

### Governance

Workspace policies (`lib/domain/workspace-policies.ts`):

- `policies.assistant.assistantEnabled`
- `policies.assistant.proactiveNudgesEnabled`
- `policies.assistant.assistantActionsEnabled`
- `policies.assistant.assistantThreadsEnabled`
- `policies.assistant.assistantViewerRoles`
- `policies.assistant.assistantActionRoles`

Settings page: `/settings/assistant`

## Grounding model

Assistant answers are derived from server-side tools/services, not from unverified “world knowledge”.

Examples:

- Account scope uses `getAccountExplainability(...)` and `deriveNextBestAction(...)`
- Command Center scope uses `buildCommandCenter(...)`
- Executive scope uses `buildExecutiveSummary(...)`
- Approvals scope uses `listApprovalRequests(...)`

## Action safety

Assistant actions are **two-step**:

1) Preview: `confirm=false` returns a preview payload and indicates confirmation is required.
2) Execute: `confirm=true` runs the real service and produces a durable workflow object (e.g., an action queue item).

The assistant does not send outreach or deliver downstream payloads automatically.

