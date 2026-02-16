import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/webhook (legacy)', () => {
  it('POST returns 410 deprecated', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/webhook', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.message).toContain('Deprecated')
  })
})

