// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'session_id' ? 'cs_test_123' : null),
  }),
}))

describe('/pricing/success', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('verifies via local API route and redirects to dashboard on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { verified: true, plan: 'pro', tier: 'closer', planId: 'pro' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const Page = (await import('./page')).default
    render(<Page />)

    expect(await screen.findByText(/Payment Successful!/i)).toBeTruthy()

    // Verify call should be relative and include session id.
    expect(fetchSpy).toHaveBeenCalled()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/billing\/verify-checkout-session\?session_id=cs_test_123/)
    expect(init.credentials).toBe('include')

    // Advance timers to allow redirect.
    await vi.advanceTimersByTimeAsync(900)
    expect(push).toHaveBeenCalledWith('/dashboard')
  })
})

