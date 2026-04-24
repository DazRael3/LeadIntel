import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'
import { resetAllRateLimits } from '@/lib/api/ratelimit-memory'

type LeadRow = {
  id: string
  user_id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  prospect_email: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

const dbLeads: LeadRow[] = []
let leadCounter = 0
let mockUser: { id: string; email: string } | null = null
let mockTier: 'starter' | 'closer' | 'closer_plus' | 'team' = 'closer'
let mockCandidates: Array<Record<string, unknown>> = []
let mockStrategy = {
  query: 'healthcare vp sales',
  rationale: 'focus on fit',
  channels: ['linkedin'],
  enrichmentNotes: 'n/a',
}
let mockSource: 'openai' | 'fallback' = 'fallback'
let mockWarning: string | null = null

function createLeadFromInsert(input: Record<string, unknown>): LeadRow {
  leadCounter += 1
  return {
    id: `lead-${leadCounter}`,
    user_id: String(input.user_id),
    company_name: typeof input.company_name === 'string' ? input.company_name : null,
    company_domain: typeof input.company_domain === 'string' ? input.company_domain : null,
    company_url: typeof input.company_url === 'string' ? input.company_url : null,
    prospect_email: typeof input.prospect_email === 'string' ? input.prospect_email : null,
    ai_personalized_pitch: typeof input.ai_personalized_pitch === 'string' ? input.ai_personalized_pitch : null,
    created_at: new Date().toISOString(),
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => {
      if (table !== 'leads') {
        throw new Error(`Unsupported table: ${table}`)
      }
      return {
        select: vi.fn((_cols: string) => {
          const scopedRows = dbLeads
            .filter((row) => (mockUser ? row.user_id === mockUser.id : true))
            .slice()
          return {
            eq: vi.fn((_column: string, _value: string) => ({
              order: vi.fn((_orderCol: string, _options: { ascending: boolean }) => ({
                limit: vi.fn((_n: number) => Promise.resolve({ data: scopedRows, error: null })),
              })),
            })),
            order: vi.fn((_orderCol: string, _options: { ascending: boolean }) => ({
              limit: vi.fn((_n: number) => Promise.resolve({ data: scopedRows, error: null })),
            })),
          }
        }),
        upsert: vi.fn((rows: Array<Record<string, unknown>>) => {
          const insertedRows: LeadRow[] = []
          for (const row of rows) {
            const userId = String(row.user_id ?? '')
            const domain = String(row.company_domain ?? '')
            const existing = dbLeads.find((lead) => lead.user_id === userId && lead.company_domain === domain)
            if (existing) {
              existing.company_name = typeof row.company_name === 'string' ? row.company_name : existing.company_name
              existing.company_url = typeof row.company_url === 'string' ? row.company_url : existing.company_url
              existing.prospect_email = typeof row.prospect_email === 'string' ? row.prospect_email : existing.prospect_email
              existing.ai_personalized_pitch = typeof row.ai_personalized_pitch === 'string' ? row.ai_personalized_pitch : existing.ai_personalized_pitch
              insertedRows.push(existing)
            } else {
              const created = createLeadFromInsert(row)
              dbLeads.push(created)
              insertedRows.push(created)
            }
          }
          return {
            select: vi.fn((_cols: string) => Promise.resolve({ data: insertedRows, error: null })),
          }
        }),
        update: vi.fn((updates: Record<string, unknown>) => ({
          eq: vi.fn((_colA: string, idValue: string) => ({
            eq: vi.fn((_colB: string, userIdValue: string) => {
              const row = dbLeads.find((lead) => lead.id === idValue && lead.user_id === userIdValue)
              if (!row) return Promise.resolve({ error: { message: 'not_found' } })
              if (typeof updates.company_url === 'string') row.company_url = updates.company_url
              if (typeof updates.prospect_email === 'string') row.prospect_email = updates.prospect_email
              if (typeof updates.ai_personalized_pitch === 'string') row.ai_personalized_pitch = updates.ai_personalized_pitch
              return Promise.resolve({ error: null })
            }),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((_colA: string, idValue: string) => ({
            eq: vi.fn((_colB: string, userIdValue: string) => {
              const index = dbLeads.findIndex((lead) => lead.id === idValue && lead.user_id === userIdValue)
              if (index >= 0) dbLeads.splice(index, 1)
              return Promise.resolve({ error: null })
            }),
          })),
        })),
      }
    }),
  })),
}))

vi.mock('@/lib/team/gating', () => ({
  getUserTierForGating: vi.fn(async () => mockTier),
}))

vi.mock('@/lib/services/lead-generation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/lead-generation')>('@/lib/services/lead-generation')
  return {
    ...actual,
    generateSearchStrategyAndCandidates: vi.fn(async () => ({
      strategy: mockStrategy,
      candidates: mockCandidates,
      source: mockSource,
      warning: mockWarning,
    })),
  }
})

describe('/api/leads/discover', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetAllRateLimits()
    dbLeads.length = 0
    leadCounter = 0
    mockUser = { id: 'user-1', email: 'user@example.com' }
    mockTier = 'closer'
    mockCandidates = []
    mockSource = 'fallback'
    mockWarning = null
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.CRON_SECRET = 'cron_secret_123456'
  })

  it('creates leads and deduplicates generated duplicates before insert', async () => {
    mockCandidates = [
      {
        companyName: 'Acme',
        companyDomain: 'acme.com',
        companyUrl: 'https://acme.com',
        contactEmail: 'vp@acme.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        fitNotes: ['slow pipeline velocity'],
      },
      {
        companyName: 'Acme Co',
        companyDomain: 'www.acme.com',
        companyUrl: 'https://www.acme.com',
        contactEmail: 'ceo@acme.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
      },
      {
        companyName: 'Zenith',
        companyDomain: 'zenith.io',
        companyUrl: 'https://zenith.io',
        contactEmail: 'sales@zenith.io',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
      },
    ]

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        targetIndustry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        targetRole: 'VP Sales',
        painPoint: 'slow pipeline velocity',
        offerService: 'AI lead prioritization',
        numberOfLeads: 3,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.leads).toHaveLength(2)
    expect(json.data.generation.duplicatesRemoved).toBe(1)
  })

  it('detects duplicates against existing leads and avoids new insert', async () => {
    dbLeads.push({
      id: 'existing-1',
      user_id: 'user-1',
      company_name: 'Acme Existing',
      company_domain: 'acme.com',
      company_url: 'https://acme.com',
      prospect_email: null,
      ai_personalized_pitch: null,
      created_at: new Date().toISOString(),
    })

    mockCandidates = [
      {
        companyName: 'Acme Duplicate',
        companyDomain: 'acme.com',
        companyUrl: 'https://acme.com',
        contactEmail: 'new@acme.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        fitNotes: ['slow pipeline velocity'],
      },
    ]

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        targetIndustry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        targetRole: 'VP Sales',
        painPoint: 'slow pipeline velocity',
        offerService: 'AI lead prioritization',
        numberOfLeads: 1,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.leads).toHaveLength(0)
    expect(json.data.generation.duplicatesAgainstExisting).toBe(1)
  })

  it('enforces starter lead usage limit', async () => {
    mockTier = 'starter'
    dbLeads.push(
      {
        id: 'starter-1',
        user_id: 'user-1',
        company_name: 'A',
        company_domain: 'a.com',
        company_url: 'https://a.com',
        prospect_email: null,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'starter-2',
        user_id: 'user-1',
        company_name: 'B',
        company_domain: 'b.com',
        company_url: 'https://b.com',
        prospect_email: null,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'starter-3',
        user_id: 'user-1',
        company_name: 'C',
        company_domain: 'c.com',
        company_url: 'https://c.com',
        prospect_email: null,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      }
    )

    mockCandidates = [
      {
        companyName: 'Overflow',
        companyDomain: 'overflow.com',
        companyUrl: 'https://overflow.com',
        contactEmail: 'vp@overflow.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
      },
    ]

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        targetIndustry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        targetRole: 'VP Sales',
        painPoint: 'slow pipeline velocity',
        offerService: 'AI lead prioritization',
        numberOfLeads: 1,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('GET returns list and supports minScore filter', async () => {
    dbLeads.push({
      id: 'lead-list-1',
      user_id: 'user-1',
      company_name: 'Signal One',
      company_domain: 'signal.one',
      company_url: 'https://signal.one',
      prospect_email: 'ops@signal.one',
      ai_personalized_pitch: '[LeadIntel Fit 82/100] Strong role and industry match',
      created_at: new Date().toISOString(),
    })
    dbLeads.push({
      id: 'lead-list-2',
      user_id: 'user-1',
      company_name: 'Signal Two',
      company_domain: 'signal.two',
      company_url: 'https://signal.two',
      prospect_email: 'ops@signal.two',
      ai_personalized_pitch: '[LeadIntel Fit 41/100] Weak role match',
      created_at: new Date().toISOString(),
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover?minScore=60', {
      method: 'GET',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.leads).toHaveLength(1)
    expect(json.data.leads[0].companyName).toBe('Signal One')
  })

  it('DELETE removes a lead for the authenticated user', async () => {
    dbLeads.push({
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: 'user-1',
      company_name: 'Delete Me',
      company_domain: 'delete.me',
      company_url: 'https://delete.me',
      prospect_email: 'ops@delete.me',
      ai_personalized_pitch: '[LeadIntel Fit 60/100] Delete test',
      created_at: new Date().toISOString(),
    })

    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ leadId: '123e4567-e89b-12d3-a456-426614174000' }),
    })
    const res = await DELETE(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(dbLeads.some((row) => row.id === '123e4567-e89b-12d3-a456-426614174000')).toBe(false)
  })

  it('starter tier only inserts remaining lead slots', async () => {
    mockTier = 'starter'
    dbLeads.push(
      {
        id: 'starter-slot-1',
        user_id: 'user-1',
        company_name: 'One',
        company_domain: 'one.com',
        company_url: 'https://one.com',
        prospect_email: null,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'starter-slot-2',
        user_id: 'user-1',
        company_name: 'Two',
        company_domain: 'two.com',
        company_url: 'https://two.com',
        prospect_email: null,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      }
    )

    mockCandidates = [
      {
        companyName: 'Slot A',
        companyDomain: 'slot-a.com',
        companyUrl: 'https://slot-a.com',
        contactEmail: 'a@slot-a.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
      },
      {
        companyName: 'Slot B',
        companyDomain: 'slot-b.com',
        companyUrl: 'https://slot-b.com',
        contactEmail: 'b@slot-b.com',
        targetRole: 'VP Sales',
        industry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
      },
    ]

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', 'x-forwarded-for': '10.0.0.88' },
      body: JSON.stringify({
        targetIndustry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        targetRole: 'VP Sales',
        painPoint: 'slow pipeline velocity',
        offerService: 'AI lead prioritization',
        numberOfLeads: 2,
      }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.leads).toHaveLength(STARTER_PITCH_CAP_LIMIT - 2)
    expect(json.data.usage.remaining).toBe(0)
  })

  it('requires authentication for POST', async () => {
    mockUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        targetIndustry: 'Healthcare',
        location: 'Chicago',
        companySize: '200-500',
        targetRole: 'VP Sales',
        painPoint: 'slow pipeline velocity',
        offerService: 'AI lead prioritization',
        numberOfLeads: 1,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
