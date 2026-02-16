// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

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

import { useLeadLibrary } from './useLeadLibrary'

describe('useLeadLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  })

  it('sets empty leads when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { result } = renderHook(() => useLeadLibrary())
    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.leads).toEqual([])
    expect(result.current.error).toBe(null)
  })

  it('handles query error and stops loading', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error', code: 'PGRST_ERROR' } })),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      }
    })
    const { result } = renderHook(() => useLeadLibrary())
    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.leads).toEqual([])
    expect(result.current.error).toMatch(/DB error/i)
  })

  it('loads leads successfully (empty is ok)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
      }
      if (table === 'trigger_events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    })

    const { result } = renderHook(() => useLeadLibrary())
    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe(null)
    expect(result.current.leads).toEqual([])
  })

  it('refresh() triggers reload', async () => {
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn(() => {
            callCount++
            return Promise.resolve({ data: [], error: null })
          }),
        }
      }
      if (table === 'trigger_events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    })

    const { result } = renderHook(() => useLeadLibrary())
    await act(async () => {
      await result.current.refresh()
    })
    await act(async () => {
      await result.current.refresh()
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(callCount).toBeGreaterThanOrEqual(2)
  })
})

