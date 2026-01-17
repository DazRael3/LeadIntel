# E2E Tests - Quick Start Guide

## How to Run

### 1. Install Playwright Browsers (First Time Only)

```bash
npx playwright install chromium
```

### 2. Run All Tests

```bash
npm run e2e
```

This will:
- Start the Next.js dev server automatically
- Run all E2E tests
- Show results in terminal

### 3. Run Tests in Interactive UI Mode

```bash
npm run e2e:ui
```

Opens Playwright's interactive UI where you can:
- See tests running in real-time
- Debug individual tests
- Step through execution
- View screenshots and videos

### 4. Run Tests with Visible Browser

```bash
npm run e2e:headed
```

Runs tests with visible browser windows (useful for debugging).

## Test Coverage

✅ **16 tests** across **4 test files**:

1. **Login Flow** (`login.spec.ts`) - 5 tests
   - Login page display
   - Sign in/sign up mode switching
   - Form validation
   - Successful authentication

2. **Pricing & Checkout** (`pricing.spec.ts`) - 3 tests
   - Pricing page loads
   - Checkout navigation (mocked, no real payments)
   - Pricing information display

3. **Dashboard** (`dashboard.spec.ts`) - 4 tests
   - Redirects unauthenticated users
   - Loads for authenticated users
   - User information display
   - Dashboard interactions

4. **Generate Pitch API** (`api-generate-pitch.spec.ts`) - 4 tests
   - Returns valid response envelope
   - Requires authentication
   - Validates request body
   - Enforces rate limiting
   - **Mocks OpenAI** to avoid costs

## Environment Setup

### Test User Credentials (Optional)

Create a test user in Supabase or set environment variables:

```bash
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=test-password-123
```

If not set, tests use defaults from `e2e/fixtures.ts`.

### Test Mode

Tests automatically mock external APIs (OpenAI, Stripe) to:
- Avoid costs
- Ensure determinism
- Run without external dependencies

## Common Failure Fixes

### ❌ "Browser not installed"

**Error**: `Executable doesn't exist`

**Fix**:
```bash
npx playwright install chromium
```

### ❌ "Port 3000 already in use"

**Error**: `Port 3000 is already in use`

**Fix**:
1. Stop any running dev server: `Ctrl+C` in terminal
2. Or change port in `playwright.config.ts`:
   ```typescript
   webServer: {
     url: 'http://localhost:3001',
   }
   ```

### ❌ "Authentication fails"

**Error**: `Timeout waiting for navigation to /dashboard`

**Fix**:
1. Verify test user exists in Supabase
2. Check credentials: `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD`
3. Ensure email confirmation is disabled for test users
4. Check Supabase auth settings

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

## Test Structure

### Using Fixtures

```typescript
import { test, expect } from './fixtures'

test('should work', async ({ authenticatedPage }) => {
  // authenticatedPage is pre-authenticated
  await expect(authenticatedPage).toHaveURL(/\/dashboard/)
})
```

### Mocking External APIs

```typescript
// Mock OpenAI before API call
await page.route('https://api.openai.com/**', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify({ choices: [{ message: { content: 'Mock' } }] }),
  })
})
```

## CI Integration

Tests run automatically in CI with:
- Headless browsers
- 2 retries on failure
- GitHub Actions reporter
- Automatic dev server startup

## Next Steps

- Add more test coverage for other features
- Add visual regression tests
- Add performance tests
- Add mobile viewport tests

For detailed documentation, see `docs/E2E_TESTING.md` and `e2e/README.md`.
