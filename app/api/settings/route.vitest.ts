import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const upsertCalls: unknown[] = []

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'u1@example.com' } }, error: null })),
    },
    from: (table: string) => {
      if (table !== 'user_settings') throw new Error('unexpected table')
      return {
        upsert: (row: unknown) => {
          upsertCalls.push(row)
          return {
            select: () => ({
              single: async () => ({
                data: { user_id: 'user_1', onboarding_completed: true, updated_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }
        },
      }
    },
  })),
}))

describe('/api/settings', () => {
  beforeEach(() => {
    upsertCalls.splice(0, upsertCalls.length)
    vi.clearAllMocks()
  })

  it('accepts and persists new onboarding fields', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        display_name: 'Jane',
        from_email: 'jane@example.com',
        from_name: 'Jane',
        role: 'Founder',
        team_size: 'solo',
        primary_goal: 'outbound',
        heard_about_us_from: 'Twitter',
        preferred_contact_channel: 'email',
        preferred_contact_detail: 'jane@example.com',
        allow_product_updates: false,
        onboarding_completed: true,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(upsertCalls.length).toBe(1)
    expect(upsertCalls[0]).toMatchObject({
      user_id: 'user_1',
      role: 'Founder',
      team_size: 'solo',
      primary_goal: 'outbound',
      heard_about_us_from: 'Twitter',
      preferred_contact_channel: 'email',
      preferred_contact_detail: 'jane@example.com',
      allow_product_updates: false,
    })
  })

  it('supports minimal payloads (e.g. dismiss onboarding)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ onboarding_completed: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})

