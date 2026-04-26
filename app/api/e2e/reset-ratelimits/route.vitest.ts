import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/e2e/reset-ratelimits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.E2E_MODE = 'true'
    process.env.E2E_TOKEN = 'test-e2e-token'
  })

  it('returns 404 outside E2E/test envs', async () => {
    process.env.E2E_MODE = 'false'
    vi.doMock('@/lib/runtimeFlags', async () => {
      const actual = await vi.importActual<typeof import('@/lib/runtimeFlags')>('@/lib/runtimeFlags')
      return { ...actual, isTestEnv: () => false }
    })

    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost:3000/api/e2e/reset-ratelimits', {
        method: 'GET',
        headers: { 'x-e2e-token': 'test-e2e-token' },
      })
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('returns 401 when token is missing', async () => {
    process.env.E2E_MODE = 'true'
    process.env.E2E_TOKEN = 'test-e2e-token'
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/e2e/reset-ratelimits', { method: 'GET' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 200 when E2E mode and token are valid', async () => {
    process.env.E2E_MODE = 'true'
    process.env.E2E_TOKEN = 'test-e2e-token'
    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost:3000/api/e2e/reset-ratelimits', {
        method: 'GET',
        headers: { 'x-e2e-token': 'test-e2e-token' },
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.reset).toBe(true)
  })
})

