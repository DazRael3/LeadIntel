# CI Pipeline Summary

## Pipeline Steps

The CI pipeline runs the following steps in order:

### 1. Checkout Code
- **Action**: `actions/checkout@v4`
- **Time**: ~5 seconds

### 2. Setup Node.js
- **Action**: `actions/setup-node@v4`
- **Version**: Node.js 20
- **Cache**: npm cache (automatic)
- **Time**: ~10 seconds

### 3. Cache Dependencies
- **Action**: `actions/cache@v4`
- **Paths**: `node_modules`, `~/.npm`, `.next/cache`
- **Key**: `ubuntu-latest-node-{hash(package-lock.json)}`
- **Time**: ~2 seconds (restore) or ~0 seconds (miss)

### 4. Cache Playwright Browsers
- **Action**: `actions/cache@v4`
- **Paths**: `~/.cache/ms-playwright`
- **Key**: `ubuntu-latest-playwright-{hash(package-lock.json)}`
- **Time**: ~2 seconds (restore) or ~0 seconds (miss)

### 5. Install Dependencies
- **Command**: `npm ci`
- **Time**: 
  - ~60 seconds (first run, no cache)
  - ~10 seconds (cached)

### 6. Install Playwright Browsers
- **Command**: `npx playwright install --with-deps chromium`
- **Condition**: Only if cache miss
- **Time**: 
  - ~120 seconds (first run, no cache)
  - ~0 seconds (cached)

### 7. Lint
- **Command**: `npm run lint`
- **Time**: ~15 seconds

### 8. Typecheck
- **Command**: `npx tsc --noEmit`
- **Time**: ~25 seconds

### 9. Unit Tests
- **Command**: `npm run test`
- **Time**: ~20 seconds

### 10. Playwright Smoke Tests
- **Command**: `npm run e2e`
- **Time**: ~90 seconds

### 11. Upload Playwright Report (on failure)
- **Action**: `actions/upload-artifact@v4`
- **Condition**: `if: failure()`
- **Time**: ~5 seconds (only on failure)

### 12. Upload Playwright Test Results (on failure)
- **Action**: `actions/upload-artifact@v4`
- **Condition**: `if: failure()`
- **Time**: ~5 seconds (only on failure)

## Expected Run Times

### First Run (No Cache)
| Step | Time (seconds) |
|------|----------------|
| Checkout | 5 |
| Setup Node.js | 10 |
| Cache restore | 2 |
| Install dependencies | 60 |
| Install Playwright | 120 |
| Lint | 15 |
| Typecheck | 25 |
| Unit tests | 20 |
| Playwright tests | 90 |
| **Total** | **~347 seconds (~5.8 minutes)** |

### Subsequent Runs (With Cache)
| Step | Time (seconds) |
|------|----------------|
| Checkout | 5 |
| Setup Node.js | 10 |
| Cache restore | 2 |
| Install dependencies | 10 |
| Install Playwright | 0 (cached) |
| Lint | 15 |
| Typecheck | 25 |
| Unit tests | 20 |
| Playwright tests | 90 |
| **Total** | **~177 seconds (~3 minutes)** |

### Typical PR Run
- **Average**: ~3-4 minutes (with caches)
- **Maximum**: ~6 minutes (first run or cache miss)

## Quality Gates

All checks must pass for PR to be mergeable:

1. ✅ **Lint** - ESLint passes
2. ✅ **Typecheck** - TypeScript compiles without errors
3. ✅ **Unit Tests** - All Vitest tests pass
4. ✅ **Playwright Tests** - All E2E smoke tests pass

## Artifacts on Failure

If Playwright tests fail, the following artifacts are uploaded:

1. **playwright-report/** - HTML report with screenshots/videos
2. **test-results/** - Raw test results and traces

Retention: 7 days

## Environment

- **OS**: `ubuntu-latest`
- **Node.js**: `20`
- **No Secrets Required**: All external services are mocked

## Caching Strategy

### Node Modules Cache
- **Hit Rate**: ~90% (when `package-lock.json` unchanged)
- **Savings**: ~50 seconds per run

### Playwright Browsers Cache
- **Hit Rate**: ~95% (browsers rarely change)
- **Savings**: ~120 seconds per run

### Total Cache Savings
- **First Run**: 0 seconds (no cache)
- **Subsequent Runs**: ~170 seconds (~2.8 minutes)

## Branch Protection

To enforce CI checks:

1. Go to **Settings** → **Branches**
2. Add protection rule for `main`/`master`
3. Enable **Require status checks to pass before merging**
4. Select **quality-gates** check
5. Save

## Pipeline File

Location: `.github/workflows/ci.yml`

## Related Documentation

- `docs/CI_PIPELINE.md` - Complete CI pipeline documentation
- `docs/TESTING.md` - Unit testing guide
- `docs/E2E_TESTING.md` - E2E testing guide
