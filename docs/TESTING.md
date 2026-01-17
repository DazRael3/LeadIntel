# Testing Guide

This project uses **Vitest** for unit testing with TypeScript support and coverage reporting.

## Setup

Tests are configured in `vitest.config.ts` with:
- TypeScript path aliases (`@/*` → `./`)
- Node.js test environment (no browser APIs)
- Coverage reporting with v8 provider
- Global mocks for external services (Supabase, Stripe, OpenAI, Resend)

## Running Tests

### Run all tests once
```bash
npm run test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

Coverage report will be generated in:
- **Terminal**: Text summary
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json`

## Test Files

Tests are located alongside source files with `.vitest.ts` or `.test.ts` extension:

- `lib/env.test.ts` - Environment variable validation tests
- `lib/api/validate.vitest.ts` - Request validation utilities tests
- `lib/api/http.vitest.ts` - HTTP response helpers tests

## Test Structure

### Example Test

```typescript
import { describe, it, expect } from 'vitest'

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction()
    expect(result).toBe(expected)
  })
})
```

## Mocks

External services are automatically mocked in `vitest.setup.ts`:

- **Supabase**: `@supabase/supabase-js` - Mocked client with auth methods
- **Stripe**: `stripe` - Mocked Stripe SDK
- **OpenAI**: `openai` - Mocked OpenAI client
- **Resend**: `resend` - Mocked Resend email client

This allows tests to run without requiring API keys or external services.

## Coverage Thresholds

Current coverage thresholds (in `vitest.config.ts`):
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

These can be adjusted as needed.

## Writing Tests

### Best Practices

1. **Test pure functions** - Extract business logic to testable functions
2. **Mock external dependencies** - Use `vi.mock()` for external services
3. **Test error cases** - Include tests for validation errors, edge cases
4. **Use descriptive test names** - `it('should reject invalid input', ...)`
5. **Keep tests isolated** - Each test should be independent

### Testing API Routes

For API route testing, use mocked Next.js request/response objects:

```typescript
import { NextRequest } from 'next/server'

const request = new NextRequest('http://localhost/api/test', {
  method: 'POST',
  body: JSON.stringify({ data: 'test' }),
  headers: { 'Content-Type': 'application/json' },
})
```

### Testing with Zod Schemas

```typescript
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  age: z.number(),
})

it('should validate valid input', () => {
  const result = schema.parse({ name: 'test', age: 25 })
  expect(result).toEqual({ name: 'test', age: 25 })
})

it('should reject invalid input', () => {
  expect(() => schema.parse({ name: '', age: 'not-a-number' })).toThrow()
})
```

## CI Integration

Tests run in CI without external services:
- All external APIs are mocked
- No environment variables required (except for schema validation tests)
- Fast execution (< 10 seconds for full suite)

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

## Next Steps

- Add integration tests for API routes
- Add E2E tests with Playwright (if needed)
- Increase coverage thresholds as test suite grows
- Add snapshot tests for complex data structures
