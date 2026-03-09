# Action recipes (guided workflow rules)

Action recipes let a workspace standardize **when** actions are prepared and queued.

This is **guided workflow orchestration**, not a generic automation builder.

---

## Data model

- **Table**: `api.action_recipes`
- **API**:
  - `GET /api/workspace/recipes`
  - `POST /api/workspace/recipes` (owner/admin)
  - `PATCH /api/workspace/recipes/:recipeId` (owner/admin)

Recipes are typed and validated in:

- `lib/domain/action-recipes.ts`
- `lib/services/action-recipes.ts`

---

## Supported triggers

- `manual_action`
- `brief_saved`
- `report_generated`
- `tracked_account_added`
- `account_score_threshold`
- `momentum_state`
- `first_party_intent_state`

## Supported actions (current wave)

- `prepare_crm_handoff`: creates a `crm_handoff_prepared` queue item
- `prepare_sequencer_handoff`: creates a `sequencer_handoff_prepared` queue item
- `deliver_webhook_payload`: creates a `webhook_delivery` queue item (deliverable via default destination)
- `create_export_job`: creates an `export_delivery` queue item (opens Exports)
- `require_manual_review`: creates a `manual_review_required` queue item
- `save_queue_item`: creates a generic queue item (metadata only)

## How recipes run

Recipes are evaluated **when the trigger happens**:

- brief saved: `POST /api/accounts/:id/brief` (best-effort)
- report generated: `POST /api/competitive-report/generate` (best-effort)

When a recipe matches, it creates queue items in `api.action_queue_items`.

## Guardrails

- Recipes are **Team-plan gated**.
- Only `owner|admin` can create/update recipes.
- Recipes never send emails or create native CRM records directly; they prepare/queue/deliver via configured destinations.

