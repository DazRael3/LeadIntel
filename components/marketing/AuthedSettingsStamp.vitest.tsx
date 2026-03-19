import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

let mockAuthed = true

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: vi.fn(async () => ({ data: { user: mockAuthed ? { id: 'u1' } : null }, error: null })) } }),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => (mockAuthed ? ({ id: 'u1', email: 'user@example.com' } as any) : null)),
}))

describe('AuthedSettingsStamp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthed = true
    // Ensure sessionStorage exists in jsdom
    window.sessionStorage.clear()
  })

  it('posts to /api/settings/stamp (not /api/settings)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any)
    const { AuthedSettingsStamp } = await import('./AuthedSettingsStamp')
    render(<AuthedSettingsStamp payload={{ templates_viewed_at: new Date().toISOString() }} sessionKey="templates_viewed" />)

    // Wait microtask for effect async IIFE
    await Promise.resolve()
    await Promise.resolve()

    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/settings')).toBe(false)
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/settings/stamp')).toBe(true)
    fetchMock.mockRestore()
  })

  it('does not post when unauthenticated', async () => {
    mockAuthed = false
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any)
    const { AuthedSettingsStamp } = await import('./AuthedSettingsStamp')
    render(<AuthedSettingsStamp payload={{ templates_viewed_at: new Date().toISOString() }} sessionKey="templates_viewed_2" />)

    await Promise.resolve()
    await Promise.resolve()

    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })
})

