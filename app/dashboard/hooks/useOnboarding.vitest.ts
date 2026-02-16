// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/runtimeFlags', () => ({
  isE2E: vi.fn(() => false),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

import { isE2E } from '@/lib/runtimeFlags'
import { useOnboarding } from './useOnboarding'

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    window.localStorage.clear()

    ;(isE2E as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false)

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { onboarding_completed: false }, error: null })),
    })
  })

  it('completed onboarding (server flag) -> show is false', async () => {
    const { result } = renderHook(() => useOnboarding(true))
    await waitFor(() => expect(result.current.onboardingChecked).toBe(true))
    expect(result.current.showOnboarding).toBe(false)
  })

  it('session flag set -> show is false', async () => {
    window.sessionStorage.setItem('leadintel_onboarding_hidden', '1')
    const { result } = renderHook(() => useOnboarding(false))
    await waitFor(() => expect(result.current.onboardingChecked).toBe(true))
    expect(result.current.showOnboarding).toBe(false)
  })

  it('E2E mode -> show is false', async () => {
    ;(isE2E as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    const { result } = renderHook(() => useOnboarding(false))
    await waitFor(() => expect(result.current.onboardingChecked).toBe(true))
    expect(result.current.showOnboarding).toBe(false)
  })

  it('incomplete onboarding and authenticated user -> show is true', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { onboarding_completed: false }, error: null })),
    })
    const { result } = renderHook(() => useOnboarding(false))
    await waitFor(() => expect(result.current.onboardingChecked).toBe(true))
    expect(result.current.showOnboarding).toBe(true)
  })
})

