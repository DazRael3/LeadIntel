# AI audit runner (local, zero-cost)

This repo includes a **local audit runner** that generates an artifact bundle (screenshots + HTML + errors + metadata) that you can upload to ChatGPT for a full website + product audit.

It is **not** a hosted service and does **not** give ChatGPT direct access to your app.

## First-time setup (required)

1) Install dependencies:

```bash
npm ci
```

2) Install Playwright browser binaries (first run only):

```bash
npx playwright install chromium
```

### Windows PowerShell note (npm.ps1 / npx.ps1 blocked)
If PowerShell script execution is blocked (common with some antivirus policies), use `npm.cmd` / `npx.cmd` instead:

```powershell
& "C:\Program Files\nodejs\npx.cmd" playwright install chromium
& "C:\Program Files\nodejs\npm.cmd" run audit:doctor
```

3) Optional but recommended: run the diagnostic checker:

```bash
npm run audit:doctor
```

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

Run public audit (cross-platform CLI flags — recommended):

```bash
npm run audit:ai -- --baseUrl="https://dazrael.com" --scope="public"
```

Run public audit (env vars — optional):

```bash
AUDIT_BASE_URL="https://dazrael.com" \
AUDIT_SCOPE="public" \
npm run audit:ai
```

### Windows PowerShell notes
If your antivirus blocks PowerShell’s `npm.ps1`, run npm via `npm.cmd` or `cmd.exe`.

**PowerShell (preferred):**

```powershell
$env:AUDIT_BASE_URL = "https://dazrael.com"
$env:AUDIT_SCOPE = "public"
& "C:\Program Files\nodejs\npm.cmd" run audit:ai
```

**Or via cmd.exe:**

```powershell
cmd /c "set AUDIT_BASE_URL=https://dazrael.com&& set AUDIT_SCOPE=public&& npm run audit:ai"
```

Find output under:
- `admin-reports/ai-site-audit/<timestamp>/`

Upload to ChatGPT:
- `REPORT.md`
- `screenshots/` (folder)
- `console-errors.json`
- `network-failures.json`

## B) Optional logged-in audit (no stored passwords)

Logged-in auditing is optional. It **does not** store passwords in code or env.

### Step 1 — Create a Playwright session once

Run (cross-platform CLI flags — recommended):

```bash
npm run audit:storage -- --baseUrl="https://dazrael.com"
```

Run (env vars — optional):

```bash
AUDIT_BASE_URL="https://dazrael.com" \
npm run audit:storage
```

**Windows PowerShell equivalent (no `npm.ps1`):**

```powershell
$env:AUDIT_BASE_URL = "https://dazrael.com"
& "C:\Program Files\nodejs\npm.cmd" run audit:storage
```

A browser opens. Log in manually. The script will accept **any post-login page** (dashboard or onboarding) and then saves:

`admin-reports/ai-site-audit/storageState.json`

### Step 2 — Run the audit using storageState

Cross-platform CLI flags (recommended):

```bash
npm run audit:ai -- --baseUrl="https://dazrael.com" --scope="all" --storageState="admin-reports/ai-site-audit/storageState.json"
```

```bash
AUDIT_BASE_URL="https://dazrael.com" \
AUDIT_SCOPE="all" \
AUDIT_STORAGE_STATE="admin-reports/ai-site-audit/storageState.json" \
npm run audit:ai
```

**Windows PowerShell equivalent (no `npm.ps1`):**

```powershell
$env:AUDIT_BASE_URL = "https://dazrael.com"
$env:AUDIT_SCOPE = "all"
$env:AUDIT_STORAGE_STATE = "admin-reports/ai-site-audit/storageState.json"
& "C:\Program Files\nodejs\npm.cmd" run audit:ai
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

- Windows PowerShell equivalent:

```powershell
Remove-Item -Force "admin-reports\ai-site-audit\storageState.json"
```

- Audit output folders are already ignored by git (`admin-reports/` is in `.gitignore`).

## Useful knobs (optional)
- `AUDIT_MAX_ROUTES=120` to cap how many routes are audited.
- `AUDIT_PUBLIC_ROUTES="/,/pricing,/trust"` to override the public seed list.
- `AUDIT_LOGGED_IN_ROUTES="/dashboard,/settings/workspace"` to override logged-in seed list.

### CLI flag equivalents (cross-platform)
- `--maxRoutes=120`
- `--publicRoutes="/,/pricing,/trust"`
- `--loggedInRoutes="/dashboard,/settings/workspace"`

