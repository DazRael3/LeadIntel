# E2E Tests - Quick Start

## Run locally

### Install browsers (first time)

```bash
npm run test:e2e:install
```

### Run the suite

```bash
npm run test:e2e
```

### Run with UI runner

```bash
npm run test:e2e:ui
```

## Environment variables

The suite is **env-driven** and will fail with a clear error if required variables are missing.

- **Base URL**: `E2E_BASE_URL` (defaults to `http://localhost:3000`)
- **Login test**: `E2E_EMAIL`, `E2E_PASSWORD`
- **Team tests**: `E2E_TEAM_EMAIL`, `E2E_TEAM_PASSWORD`, `E2E_INVITEE_EMAIL`
- **Webhook target**: `E2E_WEBHOOK_TARGET_URL`

## Test locations

- E2E specs live in `tests/e2e/`
- Stable selectors are provided via `data-testid` across key flows.

## Common failure fixes

### ❌ "Browser not installed"

**Error**: `Executable doesn't exist`

**Fix**:
```bash
npx playwright install chromium
```

### ❌ Port already in use

**Error**: `Port 3000 is already in use`

**Fix**:
1. Stop any running dev server: `Ctrl+C` in terminal
2. Or set `E2E_BASE_URL` to a different port and run the app there.

### ❌ Authentication fails

**Error**: `Timeout waiting for navigation to /dashboard`

**Fix**:
1. Check `E2E_EMAIL` / `E2E_PASSWORD`
2. Confirm the account can log in via `/login`

### ❌ "API calls not mocked"

**Error**: Real API calls being made (costs money)

**Fix**:
- Tests automatically mock OpenAI via Playwright route interception
- Verify mock is set up before API call in test file
- Check that route pattern matches: `https://api.openai.com/**`

### ❌ "Tests timeout"

**Error**: `Test timeout of 30000ms exceeded`

**Fix**:
1. Increase timeout in `playwright.config.ts`:
   ```typescript
   timeout: 60 * 1000, // 60 seconds
   ```
2. Check dev server startup time
3. Add explicit waits in tests:
   ```typescript
   await page.waitForSelector('selector')
   ```

### ❌ "Flaky tests"

**Error**: Tests pass sometimes, fail other times

**Fix**:
1. Add explicit waits for dynamic content
2. Use `waitForURL` for navigation:
   ```typescript
   await page.waitForURL('/dashboard', { timeout: 10000 })
   ```
3. Increase retries in CI (already configured)

## CI

See `.github/workflows/e2e.yml` for the Playwright workflow. It runs on PRs and can be triggered manually.
