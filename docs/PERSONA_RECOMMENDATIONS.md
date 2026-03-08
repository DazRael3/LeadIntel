# Persona recommendations (signal-based)

LeadIntel’s **People** layer is designed to answer: **“Who should we contact first, and why?”** without pretending to have a universal contact database.

## What it is
- **Persona-level recommendations**, not named contacts.
- **Heuristic and signal-based**: derived from the account’s observed signals and (when available) first-party intent.
- **Operator-oriented** output: a suggested champion/economic buyer/evaluator set plus message directions.

## What it is not
- Not a contact enrichment database.
- Not an org chart.
- Not a claim that specific individuals exist or are verified at the account.

## Where it lives in the product
- Account detail: `components/account/RecommendedPeopleCard.tsx`, `components/account/BuyingGroupCard.tsx`, `components/account/PersonaAngleCard.tsx`
- Aggregation: `lib/data/getAccountExplainability.ts`
- Derivation services:
  - `lib/services/persona-recommendations.ts`
  - `lib/services/buying-group.ts`

## Output contract (high level)
Persona recommendations include:
- suggested persona roles (e.g. VP Sales, Director RevOps)
- why recommended (tied to signals)
- suggested angle and opening direction
- suggested first-touch channel (when derivable)
- confidence label that is intentionally conservative

## Guardrails
- Persona output is labeled as **recommendations**.
- No employee names, job histories, or org structures are fabricated.
- If coverage is thin, the UI should state that directly and reduce specificity.

