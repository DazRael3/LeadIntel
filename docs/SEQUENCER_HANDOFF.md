# Sequencer handoff (sequence-ready package)

LeadIntel’s **Sequencer handoff** prepares a sequence-ready package for SDR execution.

It is **not** a sequencer, and it **does not send emails**.

The output is designed to be delivered downstream via **webhook/export workflow**.

---

## What it prepares

When a rep prepares a sequencer package from an account, LeadIntel packages:

- suggested sequence name
- target persona recommendation
- suggested opener (persona-aware when possible)
- follow-up angle
- short rep note (“what to do next”)
- limitations note when data is thin
- score + momentum + top signals

---

## API + flow

### Prepare

- **Route**: `POST /api/accounts/:accountId/actions/sequence`
- **Creates**: a queue item `sequencer_handoff_prepared`
- **Returns**: `queueItemId` + payload preview

### Deliver (via webhook destination)

- **Route**: `POST /api/workspace/actions/queue/:queueItemId/deliver`
- **Event type**: `handoff.sequencer.delivered`

---

## Payload shape

- **Builder**: `lib/services/destination-payloads.ts`
- **Type**: `SequencerHandoffPayload`

Payload is designed for downstream systems to create:

- a sequence “draft”
- a task for an SDR
- a record in a handoff log

without implying any native integration exists.

