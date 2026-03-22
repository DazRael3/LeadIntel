import { describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

function fakeReq(auth: string | null): NextRequest {
  const headers = new Headers()
  if (auth) headers.set('authorization', auth)
  return { headers } as unknown as NextRequest
}

describe('requireCronAuth', () => {
  it('allows CRON_SECRET bearer', async () => {
    vi.resetModules()
    vi.stubEnv('CRON_SECRET', 'vercel_secret')
    delete process.env.EXTERNAL_CRON_SECRET

    const { requireCronAuth } = await import('./auth')
    const res = requireCronAuth(fakeReq('Bearer vercel_secret'))
    expect(res).toBeUndefined()
  })

  it('allows EXTERNAL_CRON_SECRET bearer', async () => {
    vi.resetModules()
    vi.stubEnv('EXTERNAL_CRON_SECRET', 'external_secret')
    delete process.env.CRON_SECRET

    const { requireCronAuth } = await import('./auth')
    const res = requireCronAuth(fakeReq('Bearer external_secret'))
    expect(res).toBeUndefined()
  })

  it('rejects invalid bearer', async () => {
    vi.resetModules()
    vi.stubEnv('CRON_SECRET', 'vercel_secret')
    vi.stubEnv('EXTERNAL_CRON_SECRET', 'external_secret')

    const { requireCronAuth } = await import('./auth')
    const res = requireCronAuth(fakeReq('Bearer wrong'))
    expect(res).toBeDefined()
    // NextResponse.json -> body is not easily accessible here; status is enough.
    expect((res as Response).status).toBe(401)
  })
})

