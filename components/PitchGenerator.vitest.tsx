import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { PitchGenerator } from './PitchGenerator'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

// Skip the auth redirect branch during tests
vi.mock('@/lib/runtimeFlags', () => ({
  isE2E: () => true,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { subscription_tier: 'free' }, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ data: null, error: null }),
    }),
  }),
}))

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({ tier: 'starter', plan: 'free', isPro: false, trial: { active: false, endsAt: null }, loading: false, refresh: vi.fn(), planId: null }),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1' })),
}))

describe('PitchGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'development')

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/pitch-summary') {
        return new Response(JSON.stringify({ ok: true, data: { tier: 'starter', pitchesUsed: 0, pitchesLimit: 3 } }), { status: 200 })
      }
      if (u.startsWith('/api/pitch/latest')) {
        return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
      }
      if (u === '/api/generate-pitch') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              pitch: 'Hello from pitch',
              warnings: ['Pitch history not saved (missing lead id).'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    // Seed saved companies for the mocked user id (user_1).
    localStorage.setItem('leadintel_saved_companies_user_1', JSON.stringify(['visa.com']))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('shows pitch even when lead_id is missing (no UI banner)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<PitchGenerator />)

    fireEvent.change(screen.getByTestId('pitch-input'), { target: { value: 'Great Value' } })
    fireEvent.click(screen.getByTestId('pitch-generate'))

    await act(async () => {
      await Promise.resolve()
    })

    // Advance hydration debounce timers (this used to clear the freshly generated pitch)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })

    expect(await screen.findByText('Generated Pitch')).toBeTruthy()
    expect(screen.getByText('Hello from pitch')).toBeTruthy()
    expect(screen.queryByText('Database persistence warning:')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Pitch persistence] Pitch generated but lead_id is missing')
    )
  })

  it('clicking a saved company chip loads latest pitch for that company', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

    render(<PitchGenerator />)

    // Let initial effects run (loadSaved + debounce timers).
    await act(async () => {
      await Promise.resolve()
    })

    // Chip should render from localStorage.
    const chip = await screen.findByRole('button', { name: /load latest pitch for visa\.com/i })

    // Clear any hydration calls during mount.
    fetchMock.mockClear()

    fireEvent.click(chip)

    // Click path triggers immediate fetch (no debounce required).
    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalled()
    const calls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.some((u) => u.startsWith('/api/pitch/latest?') && u.includes('companyDomain=visa.com'))).toBe(true)
  })

  it('Starter at 3/3 pitches disables input and shows upgrade prompt, and only shows 3 saved chips', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/pitch-summary') {
        return new Response(JSON.stringify({ ok: true, data: { tier: 'starter', pitchesUsed: 3, pitchesLimit: 3 } }), { status: 200 })
      }
      if (u.startsWith('/api/pitch/latest')) {
        return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    localStorage.setItem('leadintel_saved_companies_user_1', JSON.stringify(['a.com', 'b.com', 'c.com', 'd.com']))

    render(<PitchGenerator />)

    expect(await screen.findByText(/You’ve used your 3 free pitches/i)).toBeTruthy()
    expect(screen.getByTestId('pitch-input')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /load latest pitch for/i }).length).toBe(3)
  })
})

