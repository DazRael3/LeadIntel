# Roadmap gap matrix (completion + truthfulness)

This matrix tracks **what’s missing or partial** and what we do about it without over-claiming.

## High-confidence gaps (repo-backed)

| Domain | Status | What exists | What’s missing | Fix now vs defer |
|---|---|---|---|---|
| Assistant/copilot | missing | no strong UI/service evidence | a grounded assistant surface with action confirmation + safety | **Defer**; remove/avoid any public implication |
| Executive/command-center | partial | general dashboard shells | dedicated exec view (density, filters, “what changed/what next”) | **Defer**; keep messaging conservative |
| Benchmarking/category intelligence | missing | — | benchmarking surfaces, privacy rules, data models | **Defer**; roadmap-only language |
| Localization/i18n | missing | — | locale routing, translations, formatting | **Defer**; avoid i18n promises |
| CRM closed loop | partial | formatting utilities | real sync/closed-loop data writes + UI | **Defer**; avoid “sync” claims |
| Developer platform | partial | policy/guard, webhooks/exports | stable public API docs/SDK | **Defer**; position as action layer not platform |
| Packaging docs | missing | pricing page + gating logic | canonical packaging docs/matrix | **Fix now** (docs only; no behavior change) |

## Consistency risks (fix now)

- **Free-tier language drift**: ensure *every* public/product surface says “3 preview generations total” and “usage shared across pitches and reports.”
- **Version link drift**: footer/trust/status must route to `/version` (human).
- **Use-case drift**: keep “use cases” tied to actual plays/templates + the bounded vertical registry.

## What we will not do in this pass

- Add new major systems (assistant, CRM sync, benchmarking) without end-to-end backing.
- Add “industry pages” or “enterprise certifications.”
- Change core entitlements or unlock premium content on Free.

