# E2E Testing (Playwright)

## Overview

The E2E suite runs real-browser tests against a local Next.js server. In E2E mode, the app uses an in-memory Supabase shim for deterministic testing (no external DB writes required), and tests rely on stable `data-testid` selectors across critical flows.

## Where tests live

- Specs: `tests/e2e/*.spec.ts`
- Shared helpers: `tests/e2e/utils.ts`
- Fixtures: `tests/e2e/fixtures.ts`
- Config: `playwright.config.ts` (auto-starts the app with E2E env flags)

## Run locally

### Install browsers (first time)

```bash
npm run test:e2e:install
```

### Run the suite

```bash
npm run test:e2e
```

### Run with the UI runner

```bash
npm run test:e2e:ui
```

## Environment variables

The suite is **env-driven** and will fail with a clear error if required variables are missing.

- **Base URL**: `E2E_BASE_URL` (defaults to `http://localhost:3000`)
- **Login test**: `E2E_EMAIL`, `E2E_PASSWORD`
- **Team tests**: `E2E_TEAM_EMAIL`, `E2E_TEAM_PASSWORD`, `E2E_INVITEE_EMAIL`
- **Webhook target**: `E2E_WEBHOOK_TARGET_URL`

### Example (bash)

```bash
export E2E_BASE_URL="http://localhost:3000"
export E2E_EMAIL="you@example.com"
export E2E_PASSWORD="..."
export E2E_TEAM_EMAIL="team-owner@example.com"
export E2E_TEAM_PASSWORD="..."
export E2E_INVITEE_EMAIL="invitee@example.com"
export E2E_WEBHOOK_TARGET_URL="https://example-requestbin.com/..."
```

### Example (Windows PowerShell)

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
$env:E2E_EMAIL="you@example.com"
$env:E2E_PASSWORD="..."
$env:E2E_TEAM_EMAIL="team-owner@example.com"
$env:E2E_TEAM_PASSWORD="..."
$env:E2E_INVITEE_EMAIL="invitee@example.com"
$env:E2E_WEBHOOK_TARGET_URL="https://example-requestbin.com/..."
```

## Common failure fixes

### Browser not installed

**Error**: `Executable doesn't exist`

**Fix**:

```bash
npx playwright install chromium
```

### Port already in use

**Error**: `Port 3000 is already in use`

**Fix**:

- Stop any running dev server on that port
- Or run the app on a different port and set `E2E_BASE_URL` accordingly

### Authentication fails

**Error**: `Timeout waiting for navigation to /dashboard`

**Fix**:

- Confirm `E2E_EMAIL` / `E2E_PASSWORD` are set correctly for your test account(s)
- Confirm you can log in via `/login` in a normal browser session

## CI

GitHub Actions runs the suite using `.github/workflows/e2e.yml`. Required values are passed via GitHub secrets (no credentials are committed to the repo).
