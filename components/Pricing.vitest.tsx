import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const replaceMock = vi.fn()
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}))

let mockIsPro = false
let mockTier: 'starter' | 'closer' | 'closer_plus' | 'team' = 'starter'
vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({ isPro: mockIsPro, tier: mockTier, isHouseCloserOverride: false }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) } }),
}))

const getUserSafeMock = vi.fn()
vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: getUserSafeMock,
}))

describe('Pricing (public)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPro = false
    mockTier = 'starter'
    getUserSafeMock.mockResolvedValue(null)
    ;(globalThis as any).IntersectionObserver =
      (globalThis as any).IntersectionObserver ??
      class {
        observe() {}
        disconnect() {}
      }
  })

  it('renders signup CTA that routes free users into onboarding', async () => {
    const { Pricing } = await import('./Pricing')
    render(<Pricing />)
    const startFreeLink = screen.getByRole('link', { name: /start free/i })
    expect(startFreeLink.getAttribute('href')).toBe('/signup?redirect=/onboarding')
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

  it('does not redirect paid users away from /pricing', async () => {
    mockIsPro = true
    mockTier = 'closer'
    const { Pricing } = await import('./Pricing')
    render(<Pricing />)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('sends unauthenticated checkout attempts to login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: {} }),
      json: async () => ({}),
    } as any)

    const { Pricing } = await import('./Pricing')
    const { container } = render(<Pricing />)
    const proCard = container.querySelector('#plan-pro')
    expect(proCard).not.toBeNull()
    const checkoutButton = within(proCard as HTMLElement).getByRole('button', { name: /upgrade to pro/i })
    fireEvent.click(checkoutButton)

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login?mode=signin&redirect=/pricing')
    })
    expect(fetchMock.mock.calls.some((call) => call[0] === '/api/checkout')).toBe(false)
    fetchMock.mockRestore()
  })

  it('calls checkout API for authenticated Pro upgrade CTA', async () => {
    getUserSafeMock.mockResolvedValue({ id: 'user_1', email: 'owner@raelinfo.com' })
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, data: {} }),
      json: async () => ({}),
    } as any)

    const { Pricing } = await import('./Pricing')
    const { container } = render(<Pricing />)
    const proCard = container.querySelector('#plan-pro')
    expect(proCard).not.toBeNull()
    const checkoutButton = within(proCard as HTMLElement).getByRole('button', { name: /upgrade to pro/i })
    fireEvent.click(checkoutButton)

    await waitFor(() => {
      const checkoutCall = fetchMock.mock.calls.find((call) => call[0] === '/api/checkout')
      expect(checkoutCall).toBeTruthy()
      const options = checkoutCall?.[1] as RequestInit
      expect(options.method).toBe('POST')
      const body = JSON.parse((options.body as string) ?? '{}') as { planId?: string; billingCycle?: string }
      expect(body.planId).toBe('pro')
      expect(body.billingCycle).toBe('monthly')
    })

    fetchMock.mockRestore()
  })

  it('shows safe checkout config message from server code', async () => {
    getUserSafeMock.mockResolvedValue({ id: 'user_1', email: 'u@example.com' })
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          ok: false,
          error: { code: 'CHECKOUT_CONFIG_MISSING', message: 'Checkout is not configured yet.' },
        }),
      json: async () => ({}),
    } as any)

    const { Pricing } = await import('./Pricing')
    const { container } = render(<Pricing />)
    const proCard = container.querySelector('#plan-pro')
    expect(proCard).not.toBeNull()
    fireEvent.click(within(proCard as HTMLElement).getByRole('button', { name: /upgrade to pro/i }))

    expect(await screen.findByText('Checkout is not configured yet.')).toBeTruthy()
    fetchMock.mockRestore()
  })

  it('shows safe auth-required message from checkout error code', async () => {
    getUserSafeMock.mockResolvedValue({ id: 'user_1', email: 'u@example.com' })
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          ok: false,
          error: { code: 'AUTH_REQUIRED', message: 'Please sign in to upgrade.' },
        }),
      json: async () => ({}),
    } as any)

    const { Pricing } = await import('./Pricing')
    const { container } = render(<Pricing />)
    const proCard = container.querySelector('#plan-pro')
    expect(proCard).not.toBeNull()
    fireEvent.click(within(proCard as HTMLElement).getByRole('button', { name: /upgrade to pro/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login?mode=signin&redirect=/pricing'))
    fetchMock.mockRestore()
  })
})

