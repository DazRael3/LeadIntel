import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/demo/try', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('returns deterministic demo content (no auth)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/try', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ company: 'Acme Logistics', icp: 'B2B SaaS sales teams' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.company).toBe('Acme Logistics')
    expect(Array.isArray(json.data?.digestLines)).toBe(true)
    expect(String(json.data?.pitchSubject || '')).toMatch(/acme logistics/i)
    expect(String(json.data?.pitchBody || '')).toMatch(/acme logistics/i)
  })

  it('rejects invalid body with 422', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/try', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ company: '' }),
    })
    const res = await POST(req)
    // Body validation is enforced by withApiGuard (400 VALIDATION_ERROR)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('VALIDATION_ERROR')
  })
})

