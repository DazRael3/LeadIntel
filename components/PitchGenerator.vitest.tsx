// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

import { PitchGenerator } from './PitchGenerator'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'

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

const supabaseClientMock = {
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
}

vi.mock('@/lib/supabase/client', () => ({
  // Return a stable object so effect deps in PitchGenerator don't churn indefinitely in tests.
  createClient: () => supabaseClientMock,
}))

let tierMock: 'starter' | 'closer' = 'starter'
vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({
    tier: tierMock,
    plan: tierMock === 'starter' ? 'free' : 'pro',
    isPro: tierMock !== 'starter',
    trial: { active: false, endsAt: null },
    loading: false,
    refresh: vi.fn(),
    planId: tierMock === 'closer' ? 'pro' : null,
  }),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1' })),
}))

describe('PitchGenerator', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    tierMock = 'starter'
    localStorage.clear()

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/premium-generations') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              capabilities: { tier: 'starter' },
              usage: { used: 0, limit: STARTER_PITCH_CAP_LIMIT, remaining: STARTER_PITCH_CAP_LIMIT },
            },
          }),
          { status: 200 }
        )
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
    localStorage.setItem('leadintel_saved_companies_anon', JSON.stringify(['visa.com']))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows pitch even when lead_id is missing (no UI banner)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<PitchGenerator />)

    fireEvent.change(screen.getByTestId('pitch-input'), { target: { value: 'Great Value' } })
    fireEvent.click(screen.getByTestId('pitch-generate'))

    await act(async () => {
      await Promise.resolve()
    })

    await waitFor(() => expect(screen.getByText('Hello from pitch')).toBeTruthy())

    expect(await screen.findByText('Generated Pitch')).toBeTruthy()
    expect(screen.getByText('Hello from pitch')).toBeTruthy()
    expect(screen.queryByText('Database persistence warning:')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Pitch persistence] Pitch generated but lead_id is missing')
    )
  })

  it('renders a clickable competitive report CTA after pitch generation', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.startsWith('/api/pitch/latest')) {
        return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
      }
      if (u === '/api/usage/premium-generations') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              capabilities: { tier: 'closer' },
              usage: { used: 0, limit: 3, remaining: 3 },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (u === '/api/generate-pitch') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              pitch: 'Hello from pitch https://dazrael.com/competitive-report',
              reportCtaHref: '/competitive-report?company=Acme&auto=1',
              warnings: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as any)
    tierMock = 'closer'

    render(<PitchGenerator />)

    fireEvent.change(screen.getByTestId('pitch-input'), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByTestId('pitch-generate'))

    await act(async () => {
      await Promise.resolve()
    })

    const link = await screen.findByRole('link', { name: /generate competitive report/i })
    expect(link).toHaveAttribute('href', '/competitive-report?company=Acme&auto=1')
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

  it('Starter at 3/3 pitches disables input and shows upgrade path', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/premium-generations') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              capabilities: { tier: 'starter' },
              usage: { used: STARTER_PITCH_CAP_LIMIT, limit: STARTER_PITCH_CAP_LIMIT, remaining: 0 },
            },
          }),
          { status: 200 }
        )
      }
      if (u.startsWith('/api/pitch/latest')) {
        return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    localStorage.setItem('leadintel_saved_companies_user_1', JSON.stringify(['a.com', 'b.com', 'c.com', 'd.com']))
    localStorage.setItem('leadintel_saved_companies_anon', JSON.stringify(['a.com', 'b.com', 'c.com', 'd.com']))

    render(<PitchGenerator />)

    await screen.findByRole('button', { name: /generate/i })
    expect(screen.getByTestId('pitch-input')).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /load latest pitch for/i }).length).toBe(4)
    expect(screen.getByRole('link', { name: /view plans/i })).toHaveAttribute('href', '/pricing?target=closer')
  })

  it('Starter at 2/3 pitches keeps prompt enabled and does not hide extra saved chips', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/premium-generations') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              capabilities: { tier: 'starter' },
              usage: { used: 2, limit: STARTER_PITCH_CAP_LIMIT, remaining: 1 },
            },
          }),
          { status: 200 }
        )
      }
      if (u.startsWith('/api/pitch/latest')) {
        return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    localStorage.setItem('leadintel_saved_companies_user_1', JSON.stringify(['a.com', 'b.com', 'c.com', 'd.com']))
    localStorage.setItem('leadintel_saved_companies_anon', JSON.stringify(['a.com', 'b.com', 'c.com', 'd.com']))
    render(<PitchGenerator />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('pitch-input')).not.toBeDisabled()
    expect(screen.getAllByRole('button', { name: /load latest pitch for/i }).length).toBe(4)
  })

  it('Closer never blurs/locks even if usage response would imply cap', async () => {
    tierMock = 'closer'
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u === '/api/usage/premium-generations') {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              capabilities: { tier: 'starter' },
              usage: { used: 999, limit: STARTER_PITCH_CAP_LIMIT, remaining: 0 },
            },
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ ok: true, data: { pitch: null } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<PitchGenerator />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('pitch-input')).not.toBeDisabled()
  })

  // Note: The product surface exposes only Starter + Closer tiers (no Team).

  it('anonymous (no user) does not call /api/usage/pitch-summary', async () => {
    const { getUserSafe } = await import('@/lib/supabase/safe-auth')
    ;(getUserSafe as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockClear()

    render(<PitchGenerator />)
    await act(async () => {
      await Promise.resolve()
    })

    const calls = fetchMock.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.some((u) => u === '/api/usage/premium-generations')).toBe(false)
  })
})

