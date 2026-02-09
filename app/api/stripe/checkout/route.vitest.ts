import { describe, expect, it } from 'vitest'

describe('/api/stripe/checkout (legacy)', () => {
  it('GET returns 410 deprecated', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(410)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.message).toContain('Deprecated')
  })
})

