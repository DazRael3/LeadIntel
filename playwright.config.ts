import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 * 
 * Configured for both CI and local development.
 */

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Maximum time one test can run
  timeout: 30 * 1000,
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'html',
  
  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // Collect trace on failure
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video off by default to keep CI lightweight.
    video: 'off',
    
    // Action timeout
    actionTimeout: 10 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before tests
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start -- -p 3000' : 'npm run dev -- -p 3000',
    url: process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === '1' || !!process.env.E2E_BASE_URL,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      E2E: '1',
      PLAYWRIGHT: '1',
      NEXT_PUBLIC_E2E: '1',
      NEXT_PUBLIC_PLAYWRIGHT: '1',
    },
  },
})
