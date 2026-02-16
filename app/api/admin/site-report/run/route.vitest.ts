import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/siteReports', () => ({
  runDailySiteReport: vi.fn(async () => ({ report_date: '2026-01-01', summary: 'ok' })),
}))

describe('/api/admin/site-report/run', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.SITE_REPORT_CRON_SECRET = 'sr_secret'
    process.env.ENABLE_SITE_REPORTS = 'true'
  })

  it('missing/invalid cron secret -> 401', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/site-report/run', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('valid cron secret -> 200', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/site-report/run', {
      method: 'POST',
      headers: { 'x-cron-secret': 'sr_secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.ok).toBe(true)
  })
})

