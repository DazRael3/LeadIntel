# First-party intent (website visitor intelligence)

LeadIntel’s first-party intent surface summarizes **observed** website visitor activity when it can be matched to an account domain.

## What it is
- A **derived label** (e.g., Early intent, Active research) based on:
  - recent visitor matches
  - repeat activity
  - freshness window
- A compact summary intended to support timing decisions.

## What it is not
- Not inferred “buyer intent” without observed signals.
- Not a raw provider payload dump.
- Not a guarantee of buying activity.

## Where it lives in the codebase
- Derivation: `lib/services/first-party-intent.ts`
- Aggregation: `lib/data/getAccountExplainability.ts`
- UI:
  - `components/account/IntentSummaryBar.tsx`
  - `components/account/FirstPartyIntentCard.tsx` (account detail)

## Labels
Labels are intentionally simple and deterministic:
- **No first-party intent yet**
- **Early intent**
- **Active research**
- **Returning interest**

If there is no domain match, the UI should show a premium empty state explaining what would appear when first-party context is available.

