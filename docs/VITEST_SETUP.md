# Vitest Unit Test Framework Setup

## Summary

Vitest has been configured as the unit test framework for this project with TypeScript support, path aliases, and coverage reporting.

## New Scripts in package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Running Tests Locally

### Run all tests once
```bash
npm run test
```

**Output:**
```
✓ lib/env.test.ts  (8 tests) 34ms
✓ lib/api/http.vitest.ts  (17 tests) 56ms
✓ lib/api/validate.vitest.ts  (17 tests) 162ms

Test Files  3 passed (3)
     Tests  42 passed (42)
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

This will:
- Watch for file changes
- Re-run tests automatically
- Show only changed tests by default
- Press `a` to run all tests, `q` to quit

### Run tests with coverage
```bash
npm run test:coverage
```

**Output:**
- Terminal: Text summary with coverage percentages
- HTML Report: `coverage/index.html` (open in browser)
- JSON Report: `coverage/coverage-final.json`

## Configuration

### Vitest Config (`vitest.config.ts`)

- **Environment**: Node.js (no browser APIs)
- **Path Aliases**: `@/*` → `./` (matches `tsconfig.json`)
- **Test Patterns**: `**/*.vitest.ts`, `**/*.test.ts`, `**/*.test.tsx`
- **Coverage Provider**: v8
- **Setup File**: `vitest.setup.ts` (mocks external services)

### Global Setup (`vitest.setup.ts`)

Automatically mocks:
- **Supabase** (`@supabase/supabase-js`) - Mocked client with auth methods
- **Stripe** (`stripe`) - Mocked Stripe SDK
- **OpenAI** (`openai`) - Mocked OpenAI client
- **Resend** (`resend`) - Mocked Resend email client

Sets minimal environment variables to prevent validation errors during tests.

## Test Files

### Initial Test Suite

1. **`lib/env.test.ts`** (8 tests)
   - Client environment variable validation
   - Server environment variable validation
   - Invalid format rejection
   - Default value handling

2. **`lib/api/http.vitest.ts`** (17 tests)
   - `ok()` - Success response creation
   - `fail()` - Error response creation
   - `asHttpError()` - Error type conversion
   - Status code mapping
   - Cookie bridge forwarding

3. **`lib/api/validate.vitest.ts`** (17 tests)
   - `parseJson()` - JSON parsing with size limits
   - `validateBody()` - Zod schema validation
   - `validateQuery()` - Query parameter validation
   - `validationError()` - Error formatting
   - Payload size limit enforcement
   - Fast failure for oversized requests

### Coverage

Current coverage for tested modules:
- `lib/api/http.ts`: 93.39% lines, 82.85% functions
- `lib/api/validate.ts`: 94.31% lines, 86.95% functions

## Writing New Tests

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest'

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction()
    expect(result).toBe(expected)
  })
})
```

### Testing with Mocks

External services are automatically mocked. To mock additional modules:

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/my-module', () => ({
  myFunction: vi.fn(() => 'mocked result'),
}))
```

### Testing API Routes

```typescript
import { NextRequest } from 'next/server'

const request = new NextRequest('http://localhost/api/test', {
  method: 'POST',
  body: JSON.stringify({ data: 'test' }),
  headers: { 'Content-Type': 'application/json' },
})
```

## CI Integration

Tests run in CI without external services:
- All external APIs are mocked
- No environment variables required (except for schema validation tests)
- Fast execution (< 5 seconds for full suite)

## Dependencies

Added to `package.json`:
- `vitest` - Test framework
- `@vitest/coverage-v8` - Coverage provider

## Next Steps

1. Add more unit tests for:
   - `lib/api/ratelimit.ts`
   - `lib/api/security.ts`
   - `lib/api/schemas.ts`
   - Business logic modules

2. Increase coverage thresholds as test suite grows

3. Add integration tests for API routes (if needed)

4. Add E2E tests with Playwright (if needed)

## Troubleshooting

### Tests fail with "Cannot find module"
- Ensure TypeScript path aliases are configured in `vitest.config.ts`
- Check that `tsconfig.json` paths match

### Coverage not generating
- Ensure `@vitest/coverage-v8` is installed
- Check `vitest.config.ts` coverage configuration

### Mocks not working
- Verify `vitest.setup.ts` is loaded (check `setupFiles` in config)
- Ensure mocks are defined before imports

### Environment validation errors
- Check `vitest.setup.ts` sets minimal env vars
- Ensure env vars are set before module imports
