import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({ isPro: false, isHouseCloserOverride: false }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) } }),
}))

describe('Pricing (public)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).IntersectionObserver =
      (globalThis as any).IntersectionObserver ??
      class {
        observe() {}
        disconnect() {}
      }
  })

  it('does not POST /api/settings on render', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    } as any)

    const { Pricing } = await import('./Pricing')
    render(<Pricing />)

    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/settings')).toBe(false)
    fetchMock.mockRestore()
  })
})

