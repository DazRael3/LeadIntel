# Action Center v2 (operator-ready)

The Action Center is the “system of action” layer between signals and rep execution.

## What it supports
- Copy **why-now** summary
- Copy **persona opener** directions (persona-aware)
- Generate outreach variants (grounded in the account context)
- Save a compact account brief (persisted via existing report/brief infrastructure)
- Push/export workflow outputs via webhooks/exports (when configured/entitled)

## Where it lives
- UI: `components/account/AccountActionCenter.tsx`
- Brief generation: `lib/services/account-brief.ts`

## Safety rules
- Outputs must remain **truthful and signal-grounded**.
- Free-tier preview/locking remains intact (no premium leakage).
- Webhook/export payloads must be preview-safe when the viewer is not entitled to full content.

