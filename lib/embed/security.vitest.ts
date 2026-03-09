import { describe, expect, it } from 'vitest'

describe('embed/security', () => {
  it('signs and verifies token', async () => {
    process.env.EMBED_SIGNING_SECRET = 'x'.repeat(64)
    const mod = await import('@/lib/embed/security')
    const token = mod.signEmbedToken({ v: 1, workspaceId: 'w1', kind: 'shortlist', exp: Math.floor(Date.now() / 1000) + 60 })
    const payload = mod.verifyEmbedToken(token)
    expect(payload?.workspaceId).toBe('w1')
    expect(payload?.kind).toBe('shortlist')
  })

  it('rejects expired token', async () => {
    process.env.EMBED_SIGNING_SECRET = 'x'.repeat(64)
    const mod = await import('@/lib/embed/security')
    const token = mod.signEmbedToken({ v: 1, workspaceId: 'w1', kind: 'shortlist', exp: Math.floor(Date.now() / 1000) - 10 })
    const payload = mod.verifyEmbedToken(token)
    expect(payload).toBeNull()
  })
})

