# Destination payloads (typed, safe handoff packages)

LeadIntel generates downstream payloads for:

- CRM handoff
- Sequencer handoff
- Webhook delivery metadata events
- Export summaries (via existing export jobs)

Payload builders live in:

- `lib/services/destination-payloads.ts`

Payloads are:

- **typed**
- **versioned**
- **bounded** (string truncation to keep payloads operational)
- **metadata-first** (no raw provider dumps)

---

## CRM handoff payload

- **Type**: `CrmHandoffPayload`
- **kind**: `crm_handoff`

Includes:

- account identifiers + score/momentum
- top signals
- personas (category + why-now angle + suggested first touch)
- data quality labels + limitations
- handoff body (task/note oriented, truncated)

---

## Sequencer handoff payload

- **Type**: `SequencerHandoffPayload`
- **kind**: `sequencer_handoff`

Includes:

- sequence name suggestion
- target persona
- opener (when available)
- follow-up angle
- internal rep note
- limitations note when data is thin

---

## Redaction / safety rules

- Do not include webhook secrets.
- Do not include full report/pitch bodies in operational/admin history.
- Prefer IDs + links back to LeadIntel objects.

