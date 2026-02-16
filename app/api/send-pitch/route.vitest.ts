import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockIsPro = true
let mockLeadRow: { id: string; company_name: string | null; ai_personalized_pitch: string | null } | null = {
  id: 'lead_1',
  company_name: 'Acme',
  ai_personalized_pitch: 'Hi there',
}
let mockUserSettingsRow: { sender_name: string | null; from_email: string | null } | null = {
  sender_name: 'Sender',
  from_email: 'sender@example.com',
}

class FakeQuery {
  private table: string
  private mode: 'select_single' | 'select_maybe' | null = null
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  eq() {
    return this
  }
  single() {
    this.mode = 'select_single'
    if (this.table === 'leads') return Promise.resolve({ data: mockLeadRow, error: null })
    return Promise.resolve({ data: null, error: null })
  }
  maybeSingle() {
    this.mode = 'select_maybe'
    if (this.table === 'user_settings') return Promise.resolve({ data: mockUserSettingsRow, error: null })
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmailWithResend: vi.fn(async () => ({ ok: true, messageId: 'msg_1' })),
}))

vi.mock('@/lib/email/email-logs', () => ({
  insertEmailLog: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/send-pitch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockIsPro = true
    mockLeadRow = { id: 'lead_1', company_name: 'Acme', ai_personalized_pitch: 'Hi there' }
    mockUserSettingsRow = { sender_name: 'Sender', from_email: 'sender@example.com' }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/send-pitch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000', recipientEmail: 'a@b.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('authenticated but not pro -> 403', async () => {
    mockIsPro = false
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/send-pitch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000', recipientEmail: 'a@b.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('authenticated pro -> sends email', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/send-pitch', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000', recipientEmail: 'a@b.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.emailId).toBe('msg_1')
  })
})

