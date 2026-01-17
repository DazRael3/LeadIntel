# CI Pipeline Documentation

## Overview

The CI pipeline runs quality gates on every pull request to ensure code quality before merging. All checks must pass for a PR to be mergeable.

## Workflow File

Location: `.github/workflows/ci.yml`

## Triggers

- **Pull Requests**: Runs on all PRs to any branch
- **Push to main/master**: Runs on pushes to main/master branches
- **Concurrency**: Cancels in-progress runs for the same workflow and branch

## Quality Gates

The pipeline runs the following checks in order:

### 1. Install Dependencies
- **Command**: `npm ci`
- **Purpose**: Install all dependencies from `package-lock.json`
- **Caching**: `node_modules` and `.next/cache` are cached
- **Expected Time**: ~30-60 seconds (first run), ~5-10 seconds (cached)

### 2. Lint
- **Command**: `npm run lint`
- **Purpose**: Run ESLint to check code style and catch common errors
- **Expected Time**: ~10-20 seconds

### 3. Typecheck
- **Command**: `npx tsc --noEmit`
- **Purpose**: TypeScript type checking without emitting files
- **Expected Time**: ~15-30 seconds

### 4. Unit Tests
- **Command**: `npm run test`
- **Purpose**: Run Vitest unit tests
- **Expected Time**: ~10-30 seconds

### 5. Playwright Smoke Tests
- **Command**: `npm run e2e`
- **Purpose**: Run end-to-end smoke tests in headless mode
- **Browser**: Chromium only (for speed)
- **Caching**: Playwright browsers are cached
- **Expected Time**: ~60-120 seconds

## Caching Strategy

### Node Modules Cache
- **Key**: `${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}`
- **Paths**: `node_modules`, `~/.npm`, `.next/cache`
- **Restore Keys**: `${{ runner.os }}-node-`
- **Benefit**: Speeds up dependency installation

### Playwright Browsers Cache
- **Key**: `${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}`
- **Paths**: `~/.cache/ms-playwright`
- **Restore Keys**: `${{ runner.os }}-playwright-`
- **Benefit**: Avoids downloading browsers on every run

## Environment Variables

The pipeline sets minimal environment variables for test mode. All external services are mocked, so no real API keys are required:

```yaml
NODE_ENV: test
NEXT_PUBLIC_SUPABASE_URL: https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
# ... (see .github/workflows/ci.yml for full list)
```

## Artifacts

### On Failure

If any step fails, the following artifacts are uploaded:

1. **Playwright Report** (`playwright-report/`)
   - HTML report with test results
   - Screenshots, videos, and traces
   - Retention: 7 days

2. **Playwright Test Results** (`test-results/`)
   - Raw test results and traces
   - Retention: 7 days

### Accessing Artifacts

1. Go to the failed workflow run in GitHub Actions
2. Scroll to the bottom
3. Click on the artifact name
4. Download and extract the ZIP file
5. Open `playwright-report/index.html` in a browser

## Expected Run Times

### First Run (No Cache)
- Install dependencies: ~60 seconds
- Install Playwright browsers: ~120 seconds
- Lint: ~15 seconds
- Typecheck: ~25 seconds
- Unit tests: ~20 seconds
- Playwright tests: ~90 seconds
- **Total**: ~330 seconds (~5.5 minutes)

### Subsequent Runs (With Cache)
- Install dependencies: ~10 seconds (cached)
- Install Playwright browsers: ~5 seconds (cached)
- Lint: ~15 seconds
- Typecheck: ~25 seconds
- Unit tests: ~20 seconds
- Playwright tests: ~90 seconds
- **Total**: ~165 seconds (~2.75 minutes)

### Typical PR Run
- **Average**: ~3-4 minutes (with caches)
- **Maximum**: ~6 minutes (first run or cache miss)

## Pipeline Steps Breakdown

```yaml
1. Checkout code
   ↓
2. Setup Node.js (v20) with npm cache
   ↓
3. Cache node_modules and .next/cache
   ↓
4. Cache Playwright browsers
   ↓
5. Install dependencies (npm ci)
   ↓
6. Install Playwright browsers (if cache miss)
   ↓
7. Lint (npm run lint)
   ↓
8. Typecheck (npx tsc --noEmit)
   ↓
9. Unit tests (npm run test)
   ↓
10. Playwright smoke tests (npm run e2e)
    ↓
11. Upload artifacts (on failure)
```

## Failure Handling

### Lint Failure
- **Action**: Fix ESLint errors
- **Command**: `npm run lint` (local)
- **Auto-fix**: `npm run lint -- --fix` (if applicable)

### Typecheck Failure
- **Action**: Fix TypeScript errors
- **Command**: `npx tsc --noEmit` (local)
- **Check**: Ensure all types are correct

### Unit Test Failure
- **Action**: Fix failing tests
- **Command**: `npm run test` (local)
- **Debug**: `npm run test:watch` (interactive)

### Playwright Test Failure
- **Action**: Review test failures
- **Command**: `npm run e2e` (local)
- **Debug**: `npm run e2e:ui` (interactive)
- **Artifacts**: Download and review Playwright report

## Best Practices

### Before Pushing

1. **Run checks locally**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run test
   npm run e2e
   ```

2. **Fix issues locally** before pushing

3. **Commit and push** - CI will verify

### Debugging CI Failures

1. **Check the logs** in GitHub Actions
2. **Download artifacts** if Playwright tests failed
3. **Reproduce locally** with the same environment
4. **Fix and push** again

### Performance Optimization

1. **Keep dependencies minimal** - Faster installs
2. **Use test mocks** - No external API calls
3. **Parallelize tests** - Vitest and Playwright support this
4. **Cache aggressively** - Already configured

## Troubleshooting

### Cache Misses

If caches are frequently missing:
- Check `package-lock.json` is committed
- Verify cache keys are stable
- Consider increasing cache size limits

### Playwright Timeouts

If Playwright tests timeout:
- Check test timeouts in `playwright.config.ts`
- Review `webServer` timeout settings
- Ensure tests are deterministic

### Environment Variable Issues

If tests fail due to missing env vars:
- Check `vitest.setup.ts` for required vars
- Verify all mocks are properly configured
- Ensure test mode doesn't require real secrets

## Branch Protection

To enforce CI checks before merging:

1. Go to repository **Settings** → **Branches**
2. Add branch protection rule for `main`/`master`
3. Enable **Require status checks to pass before merging**
4. Select **quality-gates** from the list
5. Save changes

## Future Enhancements

Potential improvements:
- [ ] Parallel job execution (lint + typecheck + tests)
- [ ] Matrix testing (multiple Node.js versions)
- [ ] Coverage reporting and thresholds
- [ ] Performance benchmarks
- [ ] Security scanning
- [ ] Dependency vulnerability scanning

## Related Documentation

- `docs/TESTING.md` - Unit testing guide
- `docs/E2E_TESTING.md` - E2E testing guide
- `playwright.config.ts` - Playwright configuration
- `vitest.config.ts` - Vitest configuration
