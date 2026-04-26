import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserTierForGatingMock = vi.fn()

vi.mock('@/lib/team/gating', () => ({
  getUserTierForGating: (...args: unknown[]) => getUserTierForGatingMock(...args),
}))

describe('requireCapability', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('blocks starter users from paid capabilities', async () => {
    getUserTierForGatingMock.mockResolvedValue('starter')
    const { requireCapability } = await import('./require-capability')
    const result = await requireCapability({
      userId: 'user_starter',
      sessionEmail: 'starter@raelinfo.com',
      supabase: {} as never,
      capability: 'governance_exports',
    })

    expect(result).toEqual({ ok: false, tier: 'starter' })
  })

  it('allows closer users to access closer-tier capabilities', async () => {
    getUserTierForGatingMock.mockResolvedValue('closer')
    const { requireCapability } = await import('./require-capability')
    const result = await requireCapability({
      userId: 'user_closer',
      sessionEmail: 'closer@raelinfo.com',
      supabase: {} as never,
      capability: 'governance_exports',
    })

    expect(result).toEqual({ ok: true, tier: 'closer' })
  })

  it('keeps team-only capability locked for non-team paid tiers', async () => {
    getUserTierForGatingMock.mockResolvedValue('closer_plus')
    const { requireCapability } = await import('./require-capability')
    const result = await requireCapability({
      userId: 'user_plus',
      sessionEmail: 'plus@raelinfo.com',
      supabase: {} as never,
      capability: 'multi_workspace_controls',
    })

    expect(result).toEqual({ ok: false, tier: 'closer_plus' })
  })

  it('unlocks team capability for team tier users', async () => {
    getUserTierForGatingMock.mockResolvedValue('team')
    const { requireCapability } = await import('./require-capability')
    const result = await requireCapability({
      userId: 'user_team',
      sessionEmail: 'team@raelinfo.com',
      supabase: {} as never,
      capability: 'multi_workspace_controls',
    })

    expect(result).toEqual({ ok: true, tier: 'team' })
  })
})
