// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock Supabase client - declare mocks before vi.mock
const mockGetUser = vi.fn()

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

import { useCredits, FREE_DAILY_CREDITS } from './useCredits'

describe('useCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock setup
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: { credits_remaining: 5, last_credit_reset: new Date().toISOString() }, 
        error: null 
      })),
      update: vi.fn().mockReturnThis(),
    })
  })

  it('should initialize with provided credits', () => {
    const { result } = renderHook(() => useCredits(10, false))

    expect(result.current.creditsRemaining).toBe(10)
    expect(result.current.loading).toBe(true)
  })

  it('should set unlimited credits for Pro users', async () => {
    const { result } = renderHook(() => useCredits(5, true))

    await act(async () => {
      await result.current.loadCredits(true)
    })

    await waitFor(() => {
      expect(result.current.creditsRemaining).toBe(9999)
      expect(result.current.loading).toBe(false)
    })
  })

  it('should load credits for free users', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: { credits_remaining: 5, last_credit_reset: new Date().toISOString() }, 
        error: null 
      })),
    })

    const { result } = renderHook(() => useCredits(5, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.creditsRemaining).toBe(5)
    })
  })

  it('should reset credits if new day', async () => {
    // Use a date from far in the past to ensure reset happens
    const pastDate = '2020-01-01T00:00:00Z'
    
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: { credits_remaining: 0, last_credit_reset: pastDate }, 
        error: null 
      })),
      update: mockUpdate,
    })

    const { result } = renderHook(() => useCredits(0, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.creditsRemaining).toBe(FREE_DAILY_CREDITS)
      expect(result.current.loading).toBe(false)
    })
  })

  it('should handle errors gracefully with default credits', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'Database error', code: 'PGRST_ERROR' } 
      })),
    })

    const { result } = renderHook(() => useCredits(5, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.creditsRemaining).toBe(FREE_DAILY_CREDITS)
      expect(result.current.error).toBe('Database error (PGRST_ERROR)')
    })
  })

  it('should handle schema mismatch errors gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'column users.credits_remaining does not exist', code: 'PGRST204' } 
      })),
    })

    const { result } = renderHook(() => useCredits(5, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.creditsRemaining).toBe(FREE_DAILY_CREDITS)
      // Schema mismatch should NOT show error to user
      expect(result.current.error).toBe(null)
    })
  })

  it('should handle null data response', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: null 
      })),
    })

    const { result } = renderHook(() => useCredits(5, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.creditsRemaining).toBe(FREE_DAILY_CREDITS)
      expect(result.current.error).toBe(null)
    })
  })

  it('should handle unauthenticated users', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { result } = renderHook(() => useCredits(5, false))

    await act(async () => {
      await result.current.loadCredits(false)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.creditsRemaining).toBe(FREE_DAILY_CREDITS)
      expect(result.current.error).toBe(null)
    })
  })
})
