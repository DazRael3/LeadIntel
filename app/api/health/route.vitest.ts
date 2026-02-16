import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/health', () => ({
  getHealthReport: vi.fn(async () => ({
    status: 'ok',
    components: {
      db: { status: 'ok', message: 'ok' },
      redis: { status: 'ok', message: 'ok' },
      supabaseApi: { status: 'ok', message: 'ok' },
      resend: { status: 'ok', message: 'ok' },
      openai: { status: 'ok', message: 'ok' },
      clearbit: { status: 'ok', message: 'ok' },
    },
  })),
}))

describe('/api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok envelope with health report', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/health', { method: 'GET' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveProperty('status')
    expect(json.data).toHaveProperty('components')
  })

  it('can return degraded status', async () => {
    const { getHealthReport } = await import('@/lib/services/health')
    vi.mocked(getHealthReport).mockResolvedValueOnce({
      status: 'degraded',
      components: {
        db: { status: 'ok', message: 'ok' },
        redis: { status: 'down', message: 'down' },
        supabaseApi: { status: 'ok', message: 'ok' },
        resend: { status: 'ok', message: 'ok' },
        openai: { status: 'ok', message: 'ok' },
        clearbit: { status: 'ok', message: 'ok' },
      },
    } as any)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/health', { method: 'GET' }))
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.status).toBe('degraded')
  })
})

