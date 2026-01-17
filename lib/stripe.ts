/**
 * Stripe client singleton
 * 
 * Provides a single Stripe instance for the application.
 * Validates that STRIPE_SECRET_KEY is set and throws a clear error if missing.
 * 
 * IMPORTANT: We do NOT set apiVersion to avoid "Invalid Stripe API version" errors.
 * The Stripe SDK will use its default (latest stable) version automatically.
 * 
 * Lazy initialization: Stripe client is only created when first accessed (at runtime),
 * not during build time. This prevents build failures when env vars are missing.
 */

import Stripe from 'stripe'
import { getServerEnv } from './env'

// Lazy initialization of Stripe client
let stripeInstance: Stripe | null = null

function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const env = getServerEnv()
    const key = env.STRIPE_SECRET_KEY
    
    stripeInstance = new Stripe(key, {
      // Explicitly omit apiVersion to use Stripe SDK default (latest stable)
      // Setting an invalid apiVersion (e.g., "2024-02-28.acacia") causes errors
      // The SDK will automatically use the latest compatible version
    })
  }
  
  return stripeInstance
}

// Export a proxy that lazily initializes the Stripe client
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const client = getStripeClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client)
    }
    
    return value
  },
})
