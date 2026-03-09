# Action queue (workspace work queue)

The action queue is the workspace’s “next actions” layer for handoffs and delivery tasks.

It is designed to be:

- operational (high signal, compact)
- inspectable (metadata-first)
- safe (no secrets, no raw provider dumps)

---

## Data model

- **Table**: `api.action_queue_items`
- **Statuses**:
  - `ready`
  - `queued`
  - `processing`
  - `delivered`
  - `failed`
  - `blocked`
  - `manual_review`

---

## UI

- **Workspace queue page**: `app/dashboard/actions/*`
- Queue items are created by:
  - manual actions from the account action center
  - action recipes (guided rules)

---

## Delivery

Deliverable queue items can be delivered via:

- `POST /api/workspace/actions/queue/:queueItemId/deliver`

Delivery enqueues a webhook delivery row and records an entry in delivery history.

