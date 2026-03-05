/**
 * Vitest Global Setup
 * 
 * Runs before all tests. Use for global mocks and setup.
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock external services to avoid requiring API keys in tests
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  AuthApiError: class AuthApiError extends Error {
    status?: number
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthApiError'
      this.status = status
    }
  },
}))

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    customers: {
      create: vi.fn(() => Promise.resolve({ id: 'cus_test123' })),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(() => Promise.resolve({ url: 'https://checkout.stripe.com/test' })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(() => Promise.resolve({ url: 'https://billing.stripe.com/test' })),
      },
    },
    webhooks: {
      constructEvent: vi.fn((body, signature, secret) => ({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test123' } },
      })),
    },
  })),
}))

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(() =>
          Promise.resolve({
            choices: [{ message: { content: 'Generated content' } }],
          })
        ),
      },
    },
  })),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(() => Promise.resolve({ data: { id: 'email_123' }, error: null })),
    },
  })),
}))

// Set NODE_ENV only if not already set (it's read-only in some contexts)
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true, configurable: true })
}

// Suppress console warnings in tests (can be enabled for debugging)
// vi.spyOn(console, 'warn').mockImplementation(() => {})
