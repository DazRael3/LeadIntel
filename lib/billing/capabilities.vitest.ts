import { describe, expect, it } from 'vitest'
import { getTierCapabilities } from '@/lib/billing/capabilities'

describe('billing capabilities by tier', () => {
  it('Free (starter) has no exports or campaign automation', () => {
    const caps = getTierCapabilities('starter')
    expect(caps.governance_exports).toBe(false)
    expect(caps.action_queue).toBe(false)
  })

  it('Pro (closer) enables exports and basic campaign automation', () => {
    const caps = getTierCapabilities('closer')
    expect(caps.governance_exports).toBe(true)
    expect(caps.action_queue).toBe(true)
    expect(caps.multi_workspace_controls).toBe(false)
  })

  it('Agency (team) enables advanced campaign/workspace controls', () => {
    const caps = getTierCapabilities('team')
    expect(caps.governance_exports).toBe(true)
    expect(caps.action_queue).toBe(true)
    expect(caps.multi_workspace_controls).toBe(true)
    expect(caps.integration_delivery_audit).toBe(true)
  })
})
