import { describe, it, expect } from 'vitest'
import { getRoutePolicy, getAllRoutePolicies } from './policy'

describe('API Policy', () => {
  // List of all routes that should have policies
  const requiredRoutes = [
    'POST:/api/generate-pitch',
    'POST:/api/generate-sequence',
    'POST:/api/generate-battle-card',
    'POST:/api/generate-linkedin-comment',
    'POST:/api/unlock-lead',
    'POST:/api/send-pitch',
    'POST:/api/push-to-crm',
    'POST:/api/settings',
    'POST:/api/settings/autopilot',
    'POST:/api/tags',
    'DELETE:/api/tags',
    'POST:/api/leads/[leadId]/tags',
    'DELETE:/api/leads/[leadId]/tags',
    'POST:/api/stripe/checkout',
    'POST:/api/checkout',
    'GET:/api/history',
    'GET:/api/history/export',
    'GET:/api/tags',
    'GET:/api/plan',
    'GET:/api/whoami',
    'GET:/api/health',
    'POST:/api/stripe/portal',
    'POST:/api/reveal',
    'POST:/api/verify-email',
    'POST:/api/tracker',
    'GET:/api/tracker',
    'POST:/api/stripe/webhook',
    'POST:/api/resend/webhook',
    'POST:/api/webhook',
    'POST:/api/autopilot/run',
    'POST:/api/leads/discover',
    'POST:/api/digest/run',
    'POST:/api/digest/test',
    'POST:/api/dev/create-user',
    'GET:/api/test-error',
  ]

  it('should have policies for all required routes', () => {
    const policies = getAllRoutePolicies()
    const missingRoutes: string[] = []

    for (const route of requiredRoutes) {
      if (!(route in policies)) {
        missingRoutes.push(route)
      }
    }

    expect(missingRoutes).toEqual([])
  })

  it('should return default policy for unknown routes', () => {
    const policy = getRoutePolicy('/api/unknown-route', 'POST')
    
    expect(policy.tier).toBe('UNKNOWN')
    expect(policy.maxBytes).toBe(1024 * 1024) // 1MB default
    expect(policy.originRequired).toBe(true)
    expect(policy.devOnly).toBe(false)
    expect(policy.webhookSignatureRequired).toBe(false)
  })

  it('should return correct policy for generate-pitch', () => {
    const policy = getRoutePolicy('/api/generate-pitch', 'POST')
    
    expect(policy.tier).toBe('AI_GENERATION')
    expect(policy.maxBytes).toBe(65536) // 64KB
    expect(policy.originRequired).toBe(true)
    expect(policy.devOnly).toBe(false)
    expect(policy.webhookSignatureRequired).toBe(false)
    expect(policy.rateLimit.authPerMin).toBe(10)
    expect(policy.rateLimit.ipPerMin).toBe(5)
  })

  it('should return correct policy for stripe webhook', () => {
    const policy = getRoutePolicy('/api/stripe/webhook', 'POST')
    
    expect(policy.tier).toBe('WEBHOOK')
    expect(policy.maxBytes).toBe(262144) // 256KB
    expect(policy.originRequired).toBe(false) // Webhooks don't have origin
    expect(policy.devOnly).toBe(false)
    expect(policy.webhookSignatureRequired).toBe(true)
    expect(policy.rateLimit.authPerMin).toBe(300) // High limit (DoS backstop)
    expect(policy.rateLimit.ipPerMin).toBe(300)
  })

  it('should return correct policy for dev routes', () => {
    const policy = getRoutePolicy('/api/dev/create-user', 'POST')
    
    expect(policy.tier).toBe('DEV')
    expect(policy.devOnly).toBe(true)
  })

  it('should normalize dynamic route segments', () => {
    // Test that /api/leads/abc123/tags maps to /api/leads/[leadId]/tags
    const policy1 = getRoutePolicy('/api/leads/123e4567-e89b-12d3-a456-426614174000/tags', 'POST')
    const policy2 = getRoutePolicy('/api/leads/[leadId]/tags', 'POST')
    
    // Both should return the same policy (or at least valid policies)
    expect(policy1.tier).toBe('WRITE')
    expect(policy2.tier).toBe('WRITE')
  })
})
