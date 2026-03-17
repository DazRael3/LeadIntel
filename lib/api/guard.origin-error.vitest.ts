import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('./security', () => ({
  validateOrigin: () =>
    NextResponse.json(
      {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Origin not allowed' },
      },
      { status: 403 }
    ),
}))

describe('withApiGuard origin error handling', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns a non-empty envelope (not a blank 500) when origin is invalid', async () => {
    const { withApiGuard } = await import('./guard')

    const handler = withApiGuard(
      async () => {
        return NextResponse.json({ ok: true })
      },
      {
        // Use a policy that exists and does not require auth; skip rate limiting to avoid env coupling.
        policyName: '/api/sample-digest',
        bypassRateLimit: true,
      }
    )

    const req = new NextRequest('https://dazrael.com/api/sample-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ companyOrUrl: 'Google' }),
    })

    const res = await handler(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json).toMatchObject({ ok: false, error: { message: 'Origin not allowed' } })
  })
})

