import { describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

const loadReportsHubPageDataMock = vi.fn()
vi.mock('./loadReportsHubPageData', () => ({
  loadReportsHubPageData: (...args: unknown[]) => loadReportsHubPageDataMock(...args),
}))

describe('/reports page (server)', () => {
  it('redirects to login when user is not authenticated', async () => {
    redirectMock.mockClear()
    loadReportsHubPageDataMock.mockResolvedValueOnce({ user: null, tier: null, reports: [] })

    const mod = await import('./page')
    await expect(mod.default()).rejects.toThrow(/NEXT_REDIRECT/)

    expect(redirectMock).toHaveBeenCalledWith('/login?mode=signin&redirect=/reports')
  })
})

