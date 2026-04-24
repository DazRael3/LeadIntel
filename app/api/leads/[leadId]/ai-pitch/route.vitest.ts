import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let mockUser: { id: string; email: string } | null = { id: 'user-1', email: 'user@example.com' }
let mockTier: 'starter' | 'closer' | 'closer_plus' | 'team' = 'closer'
let mockLeadExists = true
let mockAiRows: Array<{
  id: string
  user_id: string
  lead_id: string
  generation_type: string
  output_text: string
  model: string
  prompt_version: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}> = []

const MOCK_LEAD_ID = '123e4567-e89b-12d3-a456-426614174000'

let generateCounter = 0

vi.mock('@/lib/team/gating', () => ({
  getUserTierForGating: vi.fn(async () => mockTier),
}))

vi.mock('@/lib/services/ai-pitch-generation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/ai-pitch-generation')>(
    '@/lib/services/ai-pitch-generation'
  )
  return {
    ...actual,
    generateLeadPitchBundle: vi.fn(async () => {
      generateCounter += 1
      return {
        model: 'gpt-4o-mini',
        promptVersion: 'v1',
        outputs: {
          shortEmailOpener: `Opener ${generateCounter}`,
          fullColdEmail: `Cold email ${generateCounter} with context and CTA.`,
          linkedinDm: `LinkedIn DM ${generateCounter}`,
          painPointSummary: `Pain summary ${generateCounter}`,
          recommendedOfferAngle: `Offer angle ${generateCounter}`,
          objectionHandlingNotes: `Objection handling notes ${generateCounter}`,
        },
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
        estimatedCostUsd: 0.00009,
      }
    }),
  }
})

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === 'leads') {
        return {
          select: vi.fn((_cols: string) => ({
            eq: vi.fn((_colA: string, _leadId: string) => ({
              eq: vi.fn((_colB: string, _userId: string) => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: mockLeadExists
                      ? {
                          id: MOCK_LEAD_ID,
                          company_name: 'Acme',
                          company_domain: 'acme.com',
                          company_url: 'https://acme.com',
                          ai_personalized_pitch: 'Existing draft',
                        }
                      : null,
                    error: null,
                  })
                ),
              })),
            })),
          })),
        }
      }

      if (table === 'ai_generations') {
        return {
          select: vi.fn((_cols: string, options?: { head?: boolean; count?: 'exact' }) => {
            if (options?.head) {
              return {
                eq: vi.fn((_c1: string, _v1: string) => ({
                  eq: vi.fn((_c2: string, _v2: string) => ({
                    gte: vi.fn((_c3: string, _v3: string) =>
                      Promise.resolve({
                        count: mockAiRows.length,
                        error: null,
                      })
                    ),
                  })),
                })),
              }
            }

            return {
              eq: vi.fn((_c1: string, _v1: string) => ({
                eq: vi.fn((_c2: string, _v2: string) => ({
                  eq: vi.fn((_c3: string, _v3: string) => ({
                    order: vi.fn((_c4: string, _opts: { ascending: boolean }) => ({
                      limit: vi.fn((_n: number) => ({
                        maybeSingle: vi.fn(() =>
                          Promise.resolve({
                            data: mockAiRows.length > 0 ? mockAiRows[mockAiRows.length - 1] : null,
                            error: null,
                          })
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            }
          }),
          insert: vi.fn((row: Record<string, unknown>) => ({
            select: vi.fn((_cols: string) => ({
              single: vi.fn(() => {
                const now = new Date().toISOString()
                const id = `gen-${mockAiRows.length + 1}`
                mockAiRows.push({
                  id,
                  user_id: String(row.user_id),
                  lead_id: String(row.lead_id),
                  generation_type: String(row.generation_type),
                  output_text: String(row.output_text),
                  model: String(row.model),
                  prompt_version: String(row.prompt_version),
                  prompt_tokens: Number(row.prompt_tokens),
                  completion_tokens: Number(row.completion_tokens),
                  total_tokens: Number(row.total_tokens),
                  estimated_cost_usd: Number(row.estimated_cost_usd),
                  created_at: now,
                })
                return Promise.resolve({ data: { id, created_at: now }, error: null })
              }),
            })),
          })),
        }
      }

      throw new Error(`Unsupported table: ${table}`)
    }),
  })),
}))

describe('/api/leads/[leadId]/ai-pitch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockUser = { id: 'user-1', email: 'user@example.com' }
    mockTier = 'closer'
    mockLeadExists = true
    mockAiRows = []
    generateCounter = 0
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.CRON_SECRET = 'cron_secret_123456'
  })

  it('POST validates prompt input fields', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/leads/${MOCK_LEAD_ID}/ai-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        promptInput: {
          painPoint: 'bad',
        },
      }),
    })

    const res = await POST(req, { params: Promise.resolve({ leadId: MOCK_LEAD_ID }) })
    expect(res.status).toBe(400)
  })

  it('POST stores generation and returns usage', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/leads/${MOCK_LEAD_ID}/ai-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        promptInput: {
          painPoint: 'Slow lead response times for enterprise inbound.',
          offerService: 'AI-assisted outbound and lead prioritization service.',
        },
      }),
    })

    const res = await POST(req, { params: Promise.resolve({ leadId: MOCK_LEAD_ID }) })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.generation.outputs.shortEmailOpener).toContain('Opener')
    expect(json.data.usage.used).toBe(1)
  })

  it('GET returns latest stored generation', async () => {
    mockAiRows.push({
      id: 'gen-1',
      user_id: 'user-1',
      lead_id: MOCK_LEAD_ID,
      generation_type: 'pitch_bundle',
      output_text: JSON.stringify({
        shortEmailOpener: 'Quick opener tailored to the lead signal context.',
        fullColdEmail:
          'Hi team, we noticed timing signals around your funnel velocity and built a practical outreach workflow to reduce lag between intent and first response while keeping quality and personalization high.',
        linkedinDm: 'LinkedIn DM message with clear context and one low-friction CTA.',
        painPointSummary: 'Pain summary focused on delayed follow-up and inconsistent prioritization.',
        recommendedOfferAngle: 'Offer angle centered on operational speed and relevance by segment.',
        objectionHandlingNotes:
          'If timing is not right, acknowledge priorities, offer a lighter pilot scope, and provide a measurable next step.',
      }),
      model: 'gpt-4o-mini',
      prompt_version: 'v1',
      prompt_tokens: 100,
      completion_tokens: 80,
      total_tokens: 180,
      estimated_cost_usd: 0.00009,
      created_at: new Date().toISOString(),
    })

    const { GET } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/leads/${MOCK_LEAD_ID}/ai-pitch`, {
      method: 'GET',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ leadId: MOCK_LEAD_ID }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.generation).not.toBeNull()
    expect(json.data.generation.outputs.linkedinDm).toContain('LinkedIn')
  })

  it('POST enforces starter plan generation limit', async () => {
    mockTier = 'starter'
    for (let index = 0; index < 10; index += 1) {
      mockAiRows.push({
        id: `gen-${index + 1}`,
        user_id: 'user-1',
        lead_id: MOCK_LEAD_ID,
        generation_type: 'pitch_bundle',
        output_text: JSON.stringify({
          shortEmailOpener: 'Opener',
          fullColdEmail: 'Cold email with context',
          linkedinDm: 'LinkedIn DM message',
          painPointSummary: 'Pain summary',
          recommendedOfferAngle: 'Offer angle',
          objectionHandlingNotes: 'Objection notes paragraph',
        }),
        model: 'gpt-4o-mini',
        prompt_version: 'v1',
        prompt_tokens: 100,
        completion_tokens: 80,
        total_tokens: 180,
        estimated_cost_usd: 0.00009,
        created_at: new Date().toISOString(),
      })
    }

    const { POST } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/leads/${MOCK_LEAD_ID}/ai-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ leadId: MOCK_LEAD_ID }) })
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('AI_PITCH_LIMIT_REACHED')
  })

  it('POST enforces pro monthly AI pitch limit', async () => {
    mockTier = 'closer'
    for (let index = 0; index < 300; index += 1) {
      mockAiRows.push({
        id: `gen-pro-${index + 1}`,
        user_id: 'user-1',
        lead_id: MOCK_LEAD_ID,
        generation_type: 'pitch_bundle',
        output_text: JSON.stringify({
          shortEmailOpener: 'Opener',
          fullColdEmail: 'Cold email with context',
          linkedinDm: 'LinkedIn DM message',
          painPointSummary: 'Pain summary',
          recommendedOfferAngle: 'Offer angle',
          objectionHandlingNotes: 'Objection notes paragraph',
        }),
        model: 'gpt-4o-mini',
        prompt_version: 'v1',
        prompt_tokens: 100,
        completion_tokens: 80,
        total_tokens: 180,
        estimated_cost_usd: 0.00009,
        created_at: new Date().toISOString(),
      })
    }

    const { POST } = await import('./route')
    const req = new NextRequest(`http://localhost:3000/api/leads/${MOCK_LEAD_ID}/ai-pitch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ leadId: MOCK_LEAD_ID }) })
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('AI_PITCH_LIMIT_REACHED')
  })
})
