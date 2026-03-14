# AI audit runner (local, zero-cost)

This repo includes a **local audit runner** that generates an artifact bundle (screenshots + HTML + errors + metadata) that you can upload to ChatGPT for a full website + product audit.

It is **not** a hosted service and does **not** give ChatGPT direct access to your app.

## What it produces
Each run creates a timestamped folder:

`admin-reports/ai-site-audit/YYYY-MM-DD_HH-mm-ss/`

Inside:
- `REPORT.md`
- `summary.json`
- `routes.json`
- `metadata.json`
- `console-errors.json`
- `network-failures.json`
- `heuristics.json`
- `screenshots/` (desktop + mobile)
- `html/` (HTML snapshots + per-route events)

## A) Free public audit (zero cost)

1) Install deps:

```bash
npm ci
```

2) Run public audit:

```bash
AUDIT_BASE_URL="https://dazrael.com" \
AUDIT_SCOPE="public" \
npm run audit:ai
```

3) Find output under:
- `admin-reports/ai-site-audit/<timestamp>/`

4) Upload to ChatGPT:
- `REPORT.md`
- `screenshots/` (folder)
- `console-errors.json`
- `network-failures.json`

## B) Optional logged-in audit (no stored passwords)

Logged-in auditing is optional. It **does not** store passwords in code or env.

### Step 1 — Create a Playwright session once

Run:

```bash
AUDIT_BASE_URL="https://dazrael.com" \
npm run audit:storage
```

A browser opens. Log in manually. When you reach `/dashboard`, the script saves:

`admin-reports/ai-site-audit/storageState.json`

### Step 2 — Run the audit using storageState

```bash
AUDIT_BASE_URL="https://dazrael.com" \
AUDIT_SCOPE="all" \
AUDIT_STORAGE_STATE="admin-reports/ai-site-audit/storageState.json" \
npm run audit:ai
```

If you only want authenticated pages:

```bash
AUDIT_BASE_URL="https://dazrael.com" \
AUDIT_SCOPE="logged_in" \
AUDIT_STORAGE_STATE="admin-reports/ai-site-audit/storageState.json" \
npm run audit:ai
```

## C) Cleanup (recommended)

- Delete the saved session when done:

```bash
rm -f "admin-reports/ai-site-audit/storageState.json"
```

- Audit output folders are already ignored by git (`admin-reports/` is in `.gitignore`).

## Useful knobs (optional)
- `AUDIT_MAX_ROUTES=120` to cap how many routes are audited.
- `AUDIT_PUBLIC_ROUTES="/,/pricing,/trust"` to override the public seed list.
- `AUDIT_LOGGED_IN_ROUTES="/dashboard,/settings/workspace"` to override logged-in seed list.

