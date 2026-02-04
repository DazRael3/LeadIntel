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

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1' })),
}))

describe('PitchGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'development')

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url)
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
})

