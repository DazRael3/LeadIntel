import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const runWebhookDeliveriesMock = vi.fn(async () => ({
  processed: 1,
  sent: 1,
  failed: 0,
  pending: 0,
}))
const persistJobRunMock = vi.fn(async () => ({ enabled: true }))
const tryAcquireJobLockMock = vi.fn(async () => ({ enabled: true, acquired: true }))
const releaseJobLockMock = vi.fn(async () => undefined)

vi.mock('@/lib/integrations/webhooks', () => ({
  runWebhookDeliveries: runWebhookDeliveriesMock,
}))

vi.mock('@/lib/jobs/persist', () => ({
  persistJobRun: persistJobRunMock,
}))

vi.mock('@/lib/jobs/lock', () => ({
  tryAcquireJobLock: tryAcquireJobLockMock,
  releaseJobLock: releaseJobLockMock,
}))

describe('/api/cron/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-cron-secret-123456'
  })

  it('rejects when cron auth is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/cron/webhooks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('runs webhook deliveries with valid cron bearer auth', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/cron/webhooks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-cron-secret-123456',
      },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(runWebhookDeliveriesMock).toHaveBeenCalledWith({ limit: 50 })
  })

  it('returns skipped when lock is already held', async () => {
    tryAcquireJobLockMock.mockResolvedValueOnce({ enabled: true, acquired: false })
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/cron/webhooks', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-cron-secret-123456',
      },
      body: JSON.stringify({ limit: 10 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(runWebhookDeliveriesMock).not.toHaveBeenCalled()
    expect(persistJobRunMock).toHaveBeenCalled()
  })
})
