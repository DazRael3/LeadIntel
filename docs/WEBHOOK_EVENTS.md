# Webhook events (platform events)

LeadIntel webhooks deliver **event notifications** to workspace-configured endpoints.

## Where webhooks are managed

- Settings UI: `/settings/integrations` (Team plan)
- Endpoints API: `GET/POST /api/team/webhooks`

## Delivery behavior

- Deliveries are queued in `api.webhook_deliveries`.
- A background job sends deliveries with bounded retries and sanitized error storage.
- Payload bodies are signed with an HMAC signature (see `lib/integrations/webhooks.ts`).

## Event types

Event types are defined in code as `WebhookEventType`:

- `lib/integrations/webhooks.ts`

The following event type is added for extensions:

- `custom.action.executed` — fired when a workspace custom action is executed (extensions).

Only event types present in `WebhookEventType` should be documented or relied on.

