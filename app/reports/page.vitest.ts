import { describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn()

vi.mock('next/navigation', () => ({
  permanentRedirect: (...args: unknown[]) => {
    redirectMock(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

describe('/reports page (server)', () => {
  it('redirects to /competitive-report (canonical reports hub)', async () => {
    redirectMock.mockClear()

    const mod = await import('./page')
    await expect(mod.default({ searchParams: Promise.resolve({}) })).rejects.toThrow(/NEXT_REDIRECT/)

    expect(redirectMock).toHaveBeenCalledWith('/competitive-report')
  })
})

