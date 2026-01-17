import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock Supabase client - declare mocks before vi.mock
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { useStats } from './useStats'

describe('useStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock
    mockFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ count: 42, data: null, error: null })),
    })
  })

  it('should initialize with zero leads', () => {
    const { result } = renderHook(() => useStats())

    expect(result.current.totalLeads).toBe(0)
  })

  it('should load stats successfully', async () => {
    const { result } = renderHook(() => useStats())

    await act(async () => {
      await result.current.loadStats()
    })

    await waitFor(() => {
      expect(result.current.totalLeads).toBe(42)
    })
  })

  it('should handle errors gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ 
        count: null, 
        data: null, 
        error: { message: 'Database error', code: 'PGRST_ERROR' } 
      })),
    })

    const { result } = renderHook(() => useStats())

    await act(async () => {
      await result.current.loadStats()
    })

    await waitFor(() => {
      expect(result.current.totalLeads).toBe(0) // Safe fallback
    })
  })

  it('should handle schema mismatch errors gracefully', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ 
        count: null, 
        data: null, 
        error: { message: 'relation "leads" does not exist', code: 'PGRST204' } 
      })),
    })

    const { result } = renderHook(() => useStats())

    await act(async () => {
      await result.current.loadStats()
    })

    await waitFor(() => {
      expect(result.current.totalLeads).toBe(0) // Safe fallback
    })
  })

  it('should handle null count response', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ count: null, data: null, error: null })),
    })

    const { result } = renderHook(() => useStats())

    await act(async () => {
      await result.current.loadStats()
    })

    await waitFor(() => {
      expect(result.current.totalLeads).toBe(0) // Null count defaults to 0
    })
  })

  it('should handle zero count response', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ count: 0, data: null, error: null })),
    })

    const { result } = renderHook(() => useStats())

    await act(async () => {
      await result.current.loadStats()
    })

    await waitFor(() => {
      expect(result.current.totalLeads).toBe(0)
    })
  })
})
