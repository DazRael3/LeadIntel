import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/health', () => ({
  getHealthReport: vi.fn(async () => ({
    status: 'operational',
    checkedAt: new Date().toISOString(),
    components: {
      app: { status: 'ok', message: 'ok' },
      auth: { status: 'ok', message: 'ok' },
      db: { status: 'ok', message: 'ok' },
      resend: { status: 'not_enabled', message: 'Not enabled' },
      posthog: { status: 'not_enabled', message: 'not configured' },
      sentry: { status: 'not_enabled', message: 'not configured' },
      automation: { status: 'not_enabled', message: 'automation disabled by feature flags' },
      version: { status: 'degraded', message: 'build metadata incomplete' },
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
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('Pragma')).toBe('no-cache')
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toHaveProperty('status')
    expect(json.data).toHaveProperty('components')
    expect(json.data.components).toHaveProperty('posthog')
    expect(json.data.components).toHaveProperty('sentry')
    expect(json.data.components).toHaveProperty('automation')
    expect(json.data.components).toHaveProperty('version')
  })

  it('can return degraded status', async () => {
    const { getHealthReport } = await import('@/lib/services/health')
    vi.mocked(getHealthReport).mockResolvedValueOnce({
      status: 'degraded',
      checkedAt: new Date().toISOString(),
      components: {
        app: { status: 'ok', message: 'ok' },
        auth: { status: 'degraded', message: 'Supabase auth health returned 401/403 (check ANON key)' },
        db: { status: 'ok', message: 'ok' },
        resend: { status: 'not_enabled', message: 'Not enabled' },
        posthog: { status: 'degraded', message: 'POSTHOG_PROJECT_ID must be numeric' },
        sentry: { status: 'not_enabled', message: 'not configured' },
        automation: { status: 'degraded', message: 'enabled automation jobs require cron secrets' },
        version: { status: 'degraded', message: 'build metadata incomplete' },
      },
    } as any)

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/health', { method: 'GET' }))
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.status).toBe('degraded')
  })
})

