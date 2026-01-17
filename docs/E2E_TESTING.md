# E2E Testing with Playwright

## Overview

End-to-end (E2E) tests verify critical user flows work correctly in a real browser environment. Tests run against a local Next.js dev server and mock external services to avoid costs and ensure determinism.

## Quick Start

### 1. Install Playwright Browsers (First Time Only)

```bash
npx playwright install
```

### 2. Set Up Test User (Optional)

Create a test user in Supabase or use environment variables:

```bash
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=test-password-123
```

### 3. Run Tests

```bash
npm run e2e
```

## Test Scripts

| Script | Description |
|--------|-------------|
| `npm run e2e` | Run all E2E tests |
| `npm run e2e:ui` | Run tests in interactive UI mode |
| `npm run e2e:headed` | Run tests with visible browser windows |

## Test Files

### `e2e/login.spec.ts`
Tests authentication flow:
- Login page displays correctly
- Sign in/sign up mode switching
- Form validation
- Successful authentication redirects to dashboard

### `e2e/pricing.spec.ts`
Tests pricing and checkout:
- Pricing page loads
- Upgrade button navigation
- Checkout flow (mocked, no real payments)

### `e2e/dashboard.spec.ts`
Tests dashboard for authenticated users:
- Redirects unauthenticated users to login
- Dashboard loads for authenticated users
- User information displays correctly

### `e2e/api-generate-pitch.spec.ts`
Tests AI generation API:
- Returns valid response envelope
- Requires authentication
- Validates request body
- Enforces rate limiting
- Mocks OpenAI to avoid costs

## Configuration

### Playwright Config (`playwright.config.ts`)

- **Base URL**: `http://localhost:3000`
- **Timeout**: 30 seconds per test
- **Retries**: 2 in CI, 0 locally
- **Browsers**: Chromium (default)
- **Auto-start dev server**: Yes

### Test Fixtures (`e2e/fixtures.ts`)

- **`authenticatedPage`**: Pre-authenticated page fixture
- **`testUser`**: Test user credentials (from env or defaults)

## Environment Variables

### Test User

```bash
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=test-password-123
```

### Test Mode

Set `NODE_ENV=test` to enable test mode (mocked providers).

### Base URL Override

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001
```

## How Tests Work

### 1. Authentication Flow

```typescript
test('should login successfully', async ({ authenticatedPage }) => {
  // authenticatedPage fixture handles login automatically
  await expect(authenticatedPage).toHaveURL(/\/dashboard/)
})
```

### 2. API Testing with Mocks

```typescript
// Mock OpenAI before API call
await page.route('https://api.openai.com/**', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify({ choices: [{ message: { content: 'Mock' } }] }),
  })
})

// Make API call
const response = await page.request.post('/api/generate-pitch', {
  data: { companyUrl: 'https://example.com' },
})
```

### 3. Page Interactions

```typescript
// Navigate
await page.goto('/pricing')

// Fill form
await page.fill('input[type="email"]', 'test@example.com')

// Click button
await page.click('button:has-text("Sign In")')

// Wait for navigation
await page.waitForURL('/dashboard')
```

## Common Failure Fixes

### Browser Not Installed

**Error**: `Executable doesn't exist`

**Fix**:
```bash
npx playwright install
```

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Fix**:
- Stop running dev server: `Ctrl+C`
- Or change port in `playwright.config.ts`

### Authentication Fails

**Error**: `Timeout waiting for navigation to /dashboard`

**Fix**:
- Verify test user exists in Supabase
- Check credentials in environment variables
- Ensure email confirmation is disabled for test users
- Check Supabase auth settings

### API Calls Not Mocked

**Error**: Real API calls being made

**Fix**:
- Ensure route mocking is set up before API calls
- Check that `NODE_ENV=test` is set
- Verify mock route patterns match API URLs

### Tests Timeout

**Error**: `Test timeout of 30000ms exceeded`

**Fix**:
- Increase timeout in `playwright.config.ts`
- Add explicit waits: `await page.waitForSelector('selector')`
- Check dev server startup time

### Flaky Tests

**Error**: Tests pass sometimes, fail other times

**Fix**:
- Add explicit waits for dynamic content
- Use `waitForURL` for navigation
- Increase retries in CI: `retries: 2`

## CI Integration

Tests run automatically in CI with:
- Headless browsers
- 2 retries on failure
- GitHub Actions reporter
- Automatic dev server startup

## Best Practices

1. **Use fixtures** - `authenticatedPage` for authenticated tests
2. **Mock external APIs** - Always mock OpenAI, Stripe, etc.
3. **Wait for elements** - Use `waitForSelector` instead of immediate checks
4. **Use data-testid** - Add test IDs to important elements
5. **Keep tests isolated** - Each test should be independent
6. **Test critical paths** - Focus on user-facing flows

## Debugging

### Run in UI Mode

```bash
npm run e2e:ui
```

Interactive UI with:
- Real-time test execution
- Step-through debugging
- Screenshot/video viewing

### Run in Headed Mode

```bash
npm run e2e:headed
```

See browser windows during test execution.

### Debug Single Test

```bash
npx playwright test --debug e2e/login.spec.ts
```

### View Test Report

After running tests, open:
```
playwright-report/index.html
```

## Adding New Tests

1. Create `e2e/my-feature.spec.ts`
2. Import fixtures: `import { test, expect } from './fixtures'`
3. Write tests:

```typescript
test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-page')
    await expect(page).toHaveURL(/\/my-page/)
  })
})
```

## Test Coverage

Current test coverage:
- ✅ Login flow
- ✅ Pricing page
- ✅ Dashboard (authenticated)
- ✅ Generate pitch API (with mocks)

Future additions:
- [ ] Onboarding flow
- [ ] Lead library interactions
- [ ] Settings page
- [ ] Email sequence generation
- [ ] Battle card generation
