## Cohorting model (v1)

Benchmarking uses **broad buckets** designed to avoid re-identification risk.

### Allowed cohort dimensions

Current peer-pattern bucket key is derived from:

- momentum label: `rising | steady | cooling`
- intent bucket: `active | none` (first-party intent present vs not present)
- data quality label: `strong | usable | limited`

See `lib/services/cohorting.ts`.

### What we do NOT cohort on

To avoid cross-tenant leakage, we do not cohort on:

- company name, domain, or URL
- exact geography
- tiny micro-segments
- messaging content
- user identifiers

## Eligibility and suppression

Cross-workspace cohorting is only shown when privacy thresholds are met (see `docs/BENCHMARK_PRIVACY_MODEL.md`).

If a cohort is too small or too sparse:

- the insight is suppressed
- UI shows “insufficient evidence”
- we do not expose raw counts or cohort size

