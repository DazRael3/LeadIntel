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

import { useTriggerEvents } from './useTriggerEvents'

describe('useTriggerEvents', () => {
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
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })
  })

  it('should initialize with empty events and loading state', () => {
    const { result } = renderHook(() => useTriggerEvents())

    expect(result.current.events).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
  })

  it('should load events successfully', async () => {
    const mockEvents = [
      {
        id: '1',
        company_name: 'Test Company',
        event_type: 'funding' as const,
        event_description: 'Test event',
        source_url: 'https://example.com',
        detected_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: mockEvents, error: null })),
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.events.length).toBe(1)
      expect(result.current.events[0].company_name).toBe('Test Company')
      expect(result.current.error).toBe(null)
    })
  })

  it('should handle errors when loading events', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'Database error', code: 'PGRST_ERROR' } 
      })),
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Database error (PGRST_ERROR)')
      expect(result.current.events).toEqual([])
    })
  })

  it('should handle schema mismatch errors gracefully', async () => {
    // Simulate a column-not-found error
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'column trigger_events.detected_at does not exist', code: 'PGRST204' } 
      })),
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      // Schema mismatch should NOT show error to user
      expect(result.current.error).toBe(null)
      expect(result.current.events).toEqual([])
    })
  })

  it('should handle unauthenticated users without error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      // Unauthenticated is valid state, not an error
      expect(result.current.error).toBe(null)
      expect(result.current.events).toEqual([])
    })
  })

  it('should handle empty data response', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.events).toEqual([])
    })
  })

  it('should handle null data response', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const { result } = renderHook(() => useTriggerEvents())

    await act(async () => {
      await result.current.loadEvents()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.events).toEqual([])
    })
  })
})
