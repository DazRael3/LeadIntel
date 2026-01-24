/**
 * Runtime Environment Flags
 * 
 * Centralized helpers to detect runtime environment (test, E2E, CI, production).
 * Used to conditionally enable/disable features or use different implementations.
 */

/**
 * Check if running in test environment (unit tests)
 */
export function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test'
}

/**
 * Check if running in E2E test environment (Playwright)
 */
export function isE2E(): boolean {
  // NOTE: In client bundles, only NEXT_PUBLIC_* env vars are available.
  return (
    process.env.E2E === '1' ||
    process.env.PLAYWRIGHT === '1' ||
    process.env.NEXT_PUBLIC_E2E === '1' ||
    process.env.NEXT_PUBLIC_PLAYWRIGHT === '1'
  )
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true'
}

/**
 * Check if running in any test-like environment (test, E2E, or CI)
 */
export function isTestLikeEnv(): boolean {
  return isTestEnv() || isE2E() || isCI()
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
