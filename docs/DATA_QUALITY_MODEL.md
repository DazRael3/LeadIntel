# Data Quality Model (Platform Wave)

LeadIntel surfaces **data quality** and **freshness** as compact, explainable labels. The goal is operational honesty: when coverage is thin, the product should say so rather than guessing.

## Where it appears

- Account detail: `DataQualityCard` + `SourceFreshnessCard`
- Reports: `SourceQualitySummary` (citation + freshness summary)

## Account data quality derivation

Derived deterministically from real, stored inputs:

- **Signal coverage**: number of signal events in the selected window, and diversity (unique signal types)
- **Freshness**: most recent observed timestamp across signal events and first-party visitor match (if present)
- **Explainability completeness**: presence of score reasons, momentum model, and people/buying-group layer
- **First-party presence**: domain-matched visitor activity count in the last 14 days (when available)

### Labels

- **Quality**: `limited` | `usable` | `strong`
- **Freshness**: `unknown` | `stale` | `recent` | `fresh`

### Current thresholds (intentional low precision)

LeadIntel does **not** show confidence percentages. Instead it uses coarse thresholds:

- **Freshness**:
  - `fresh`: last observed activity \( \le 2 \) days
  - `recent`: last observed activity \( \le 7 \) days
  - `stale`: last observed activity \( > 7 \) days
  - `unknown`: no timestamps available
- **Quality**:
  - `strong`: \(\ge 6\) signal events, \(\ge 2\) unique signal types, and freshness is `fresh` or `recent`
  - `usable`: \(\ge 2\) signal events **or** explainability has reasons
  - `limited`: no signals and few/no reasons

## Report source quality derivation

Report quality is summarized from:

- **Citations count**
- **Sources fetched at** freshness
- Optional **internal signals count** when available in `user_reports.meta`

The report summary is designed to be **metadata-first** and avoid implying certainty beyond the citations and freshness available.

