import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/e2e/reset-ratelimits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns 404 outside E2E/test envs', async () => {
    vi.doMock('@/lib/runtimeFlags', async () => {
      const actual = await vi.importActual<typeof import('@/lib/runtimeFlags')>('@/lib/runtimeFlags')
      return { ...actual, isE2E: () => false, isTestEnv: () => false }
    })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/e2e/reset-ratelimits', { method: 'GET' }))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})

