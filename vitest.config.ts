import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest Configuration
 * 
 * Configured for Next.js App Router with TypeScript path aliases.
 * Tests run in Node.js environment (no browser APIs).
 */
export default defineConfig({
  test: {
    // Default to node environment (for server-side tests)
    environment: 'node',
    // Enable globals (expect, describe, it, etc.)
    globals: true,
    
    // Use jsdom for React component/hook tests
    environmentMatchGlobs: [
      ['app/**/hooks/**/*.vitest.ts', 'jsdom'],
      ['components/**/*.vitest.ts', 'jsdom'],
      ['components/**/*.test.tsx', 'jsdom'],
    ],
    
    // Test file patterns
    include: ['**/*.vitest.ts', '**/*.test.ts', '**/*.test.tsx'],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'build',
      // Exclude old Node.js test runner files (they use node:test, not Vitest)
      'lib/api/ratelimit.test.ts',
      'lib/api/validate.test.ts',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        'build/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.config.*',
        '**/types.ts',
        'docs/',
        'scripts/',
      ],
      // Coverage thresholds (adjusted for initial test suite)
      // TODO: Increase thresholds as more tests are added
      thresholds: {
        lines: 0, // No global threshold yet (only testing core utilities)
        functions: 0,
        branches: 0,
        statements: 0,
        // Per-file thresholds for tested modules
        'lib/api/http.ts': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'lib/api/validate.ts': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
    
    // Global test setup
    setupFiles: ['./vitest.setup.ts'],
    
    // Test timeout
    testTimeout: 10000,
  },
  
  // Resolve TypeScript path aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
