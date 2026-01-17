# E2E Tests with Playwright

This directory contains end-to-end (E2E) tests for critical user flows.

## Test Files

- **`login.spec.ts`** - Authentication flow (sign in, sign up, validation)
- **`pricing.spec.ts`** - Pricing page and checkout flow (no real payments)
- **`dashboard.spec.ts`** - Dashboard page for authenticated users
- **`api-generate-pitch.spec.ts`** - AI generation API endpoint tests

## How to Run

### Prerequisites

1. **Install Playwright browsers** (first time only):
   ```bash
   npx playwright install
   ```

2. **Set up test user** (optional):
   - Create a test user in your Supabase project
   - Set environment variables:
     ```bash
     E2E_TEST_USER_EMAIL=test@example.com
     E2E_TEST_USER_PASSWORD=test-password-123
     ```
   - Or use the defaults in `fixtures.ts`

3. **Start the dev server** (tests will start it automatically, but you can run manually):
   ```bash
   npm run dev
   ```

### Run All Tests

```bash
npm run e2e
```

### Run Tests in UI Mode (Interactive)

```bash
npm run e2e:ui
```

This opens Playwright's interactive UI where you can:
- See tests running in real-time
- Debug individual tests
- Step through test execution
- View screenshots and videos

### Run Tests in Headed Mode (See Browser)

```bash
npm run e2e:headed
```

This runs tests with visible browser windows (useful for debugging).

### Run Specific Test File

```bash
npx playwright test e2e/login.spec.ts
```

### Run Tests in Debug Mode

```bash
npx playwright test --debug
```

## Test Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000` (or `PLAYWRIGHT_TEST_BASE_URL` env var)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries in CI, 0 locally
- **Browsers**: Chromium (Firefox/WebKit can be enabled)

## Environment Variables

### Test User Credentials

```bash
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=test-password-123
```

### Test Mode Flag

The app should check `NODE_ENV=test` to enable test mode (mocked providers).

### Base URL Override

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001
```

## Common Failure Fixes

### 1. "Browser not installed"

**Error**: `Executable doesn't exist`

**Fix**:
```bash
npx playwright install
```

### 2. "Port 3000 already in use"

**Error**: `Port 3000 is already in use`

**Fix**:
- Stop any running dev server: `Ctrl+C` in the terminal running `npm run dev`
- Or change the port in `playwright.config.ts`:
  ```typescript
  webServer: {
    url: 'http://localhost:3001',
  }
  ```

### 3. "Test user authentication fails"

**Error**: `Timeout waiting for navigation to /dashboard`

**Fix**:
- Verify test user exists in Supabase
- Check credentials in environment variables
- Ensure Supabase URL and keys are correct
- Check Supabase auth settings (email confirmation may be required)

### 4. "API calls fail with 401/403"

**Error**: `Response status 401` or `403`

**Fix**:
- Ensure `authenticatedPage` fixture is used for authenticated tests
- Check that cookies are being set correctly
- Verify Supabase auth is working

### 5. "Tests timeout"

**Error**: `Test timeout of 30000ms exceeded`

**Fix**:
- Increase timeout in `playwright.config.ts`:
  ```typescript
  timeout: 60 * 1000, // 60 seconds
  ```
- Check if dev server is slow to start
- Verify network connectivity

### 6. "OpenAI API calls not mocked"

**Error**: Real API calls being made (costs money)

**Fix**:
- Ensure route mocking is set up before API calls:
  ```typescript
  await page.route('https://api.openai.com/**', async (route) => {
    await route.fulfill({ /* mock response */ })
  })
  ```
- Check that `NODE_ENV=test` is set

### 7. "Flaky tests"

**Error**: Tests pass sometimes, fail other times

**Fix**:
- Add explicit waits for dynamic content:
  ```typescript
  await page.waitForSelector('selector')
  await page.waitForLoadState('networkidle')
  ```
- Increase retries in CI:
  ```typescript
  retries: process.env.CI ? 2 : 0,
  ```
- Use `waitForURL` for navigation:
  ```typescript
  await page.waitForURL('/dashboard', { timeout: 10000 })
  ```

### 8. "Screenshots/videos not generated"

**Fix**:
- Check `playwright.config.ts` has:
  ```typescript
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  ```
- Screenshots/videos are only saved on failure by default

## CI Integration

Tests run automatically in CI with:
- Headless browsers
- 2 retries on failure
- GitHub Actions reporter
- Automatic dev server startup

## Best Practices

1. **Use fixtures** - `authenticatedPage` fixture for authenticated tests
2. **Mock external APIs** - Always mock OpenAI, Stripe, etc. in tests
3. **Wait for elements** - Use `waitForSelector` instead of immediate checks
4. **Use data-testid** - Add `data-testid` attributes to important elements
5. **Keep tests isolated** - Each test should be independent
6. **Test critical paths** - Focus on user-facing flows

## Adding New Tests

1. Create a new `*.spec.ts` file in `e2e/`
2. Import fixtures: `import { test, expect } from './fixtures'`
3. Use `test.describe()` to group related tests
4. Use `test()` for individual test cases
5. Mock external APIs before making requests

Example:
```typescript
import { test, expect } from './fixtures'

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-page')
    await expect(page).toHaveURL(/\/my-page/)
  })
})
```
