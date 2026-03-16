// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('useStats', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('does not use head:true (avoids HEAD leads check)', async () => {
    const limitMock = vi.fn(async () => ({ count: 0, error: null }))
    const selectMock = vi.fn(() => ({ limit: limitMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))

    vi.doMock('@/lib/supabase/client', () => ({
      createClient: () => ({ from: fromMock }),
    }))

    const { useStats } = await import('./useStats')
    const { result } = renderHook(() => useStats())
    await result.current.loadStats()

    expect(fromMock).toHaveBeenCalledWith('leads')
    const firstCall = (selectMock.mock.calls[0] ?? []) as unknown[]
    expect(firstCall[0]).toBe('id')
    const opts = (firstCall[1] ?? {}) as Record<string, unknown>
    expect(opts.head).toBeUndefined()
  })
})
