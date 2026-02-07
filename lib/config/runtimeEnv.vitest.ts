import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('runtimeEnv', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.NEXT_PUBLIC_APP_ENV
    delete process.env.STRIPE_SECRET_KEY
  })

  it('APP_ENV defaults to development when NEXT_PUBLIC_APP_ENV is unset', async () => {
    const env = await import('./runtimeEnv')
    expect(env.APP_ENV).toBe('development')
  })

  it('assertProdStripeConfig does nothing when APP_ENV !== production', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const env = await import('./runtimeEnv')
    expect(() => env.assertProdStripeConfig()).not.toThrow()
  })

  it('assertProdStripeConfig throws in production when STRIPE_SECRET_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    delete process.env.STRIPE_SECRET_KEY
    const env = await import('./runtimeEnv')
    expect(() => env.assertProdStripeConfig()).toThrow(/Invalid Stripe configuration/i)
  })

  it('assertProdStripeConfig throws in production when STRIPE_SECRET_KEY is a test key', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const env = await import('./runtimeEnv')
    expect(() => env.assertProdStripeConfig()).toThrow(/Invalid Stripe configuration/i)
  })
})

