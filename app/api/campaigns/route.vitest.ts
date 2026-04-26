import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { z } from 'zod'

let mockGuardUserId: string | undefined = 'user_1'
let mockUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'team@example.com' }
let mockMembershipRole: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer' | null = 'owner'
let mockWorkspaceId: string | null = 'ws_1'
let mockCampaigns: Array<Record<string, unknown>> = []
const LEAD_ID_1 = '8ee95b88-e2d5-401f-8bdc-1b0592afb573'
const LEAD_ID_2 = '1e7f934f-cd5f-442d-8d81-b6d2cadfa3cb'
let availableLeadIds = new Set<string>([LEAD_ID_1, LEAD_ID_2])

const createCampaignRecordMock = vi.fn(async () => {
  return {
    id: 'campaign_1',
    workspace_id: 'ws_1',
    created_by: 'user_1',
    name: 'Q2 Campaign',
    objective: null,
    status: 'new',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
})

const attachLeadsToCampaignMock = vi.fn(async () => {})

vi.mock('@/lib/api/guard', () => ({
  withApiGuard:
    (
      handler: (
        req: NextRequest,
        ctx: { requestId: string; userId?: string; body?: unknown; query?: unknown }
      ) => Promise<Response> | Response
    ) =>
    async (req: NextRequest) => {
      let body: unknown
      if (req.method !== 'GET') {
        body = await req.json()
      } else {
        const includeLeads = new URL(req.url).searchParams.get('includeLeads')
        body = undefined
        return handler(req, {
          requestId: 'req_1',
          userId: mockGuardUserId,
          query: includeLeads ? { includeLeads: includeLeads === '1' || includeLeads === 'true' } : {},
        })
      }
      return handler(req, { requestId: 'req_1', userId: mockGuardUserId, body })
    },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockUser),
}))

vi.mock('@/lib/team/workspace', () => ({
  ensurePersonalWorkspace: vi.fn(async () => ({ id: 'ws_1' })),
  getCurrentWorkspace: vi.fn(async () =>
    mockWorkspaceId ? { id: mockWorkspaceId, name: 'Workspace', owner_user_id: 'user_1' } : null
  ),
  getWorkspaceMembership: vi.fn(async () => (mockMembershipRole ? { role: mockMembershipRole } : null)),
}))

let capabilityAllowed = true
vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: capabilityAllowed, tier: capabilityAllowed ? 'closer' : 'starter' })),
}))

vi.mock('@/lib/services/campaigns', () => ({
  CampaignCreateSchema: z.object({
    name: z.string().trim().min(1).max(160),
    objective: z.string().trim().max(2000).nullable().optional(),
    status: z.enum(['new', 'contacted', 'responded', 'closed', 'active', 'paused', 'archived']).optional(),
    leadIds: z.array(z.string().uuid()).max(200).optional(),
  }),
  canCreateCampaign: (role: string) => role !== 'viewer',
  summarizeCampaignStatuses: vi.fn(() => ({
    total: mockCampaigns.length,
    byStatus: {
      new: 0,
      contacted: 0,
      responded: 0,
      closed: 0,
      active: 0,
      paused: 0,
      archived: 0,
    },
    completionPct: 0,
  })),
  createCampaignRecord: createCampaignRecordMock,
  getOwnedLeadRows: vi.fn(async ({ leadIds }: { leadIds: string[] }) =>
    leadIds
      .filter((id) => availableLeadIds.has(id))
      .map((id) => ({
        id,
        company_name: `Company ${id}`,
        company_domain: `${id}.example.com`,
        company_url: `https://${id}.example.com`,
        prospect_email: `${id}@example.com`,
        ai_personalized_pitch: null,
        created_at: new Date().toISOString(),
      }))
  ),
  listCampaignLeadJoins: vi.fn(async () => []),
  listCampaignsForWorkspace: vi.fn(async () => mockCampaigns),
  attachLeadsToCampaign: attachLeadsToCampaignMock,
}))

describe('/api/campaigns', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGuardUserId = 'user_1'
    mockUser = { id: 'user_1', email: 'team@example.com' }
    mockMembershipRole = 'owner'
    mockWorkspaceId = 'ws_1'
    mockCampaigns = []
    capabilityAllowed = true
    availableLeadIds = new Set<string>([LEAD_ID_1, LEAD_ID_2])
  })

  it('blocks starter users from campaign workflow access', async () => {
    capabilityAllowed = false
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns', {
      method: 'GET',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('creates campaign with attached leads', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Q2 Campaign', leadIds: [LEAD_ID_1] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.attachedLeads).toBe(1)
    expect(attachLeadsToCampaignMock).toHaveBeenCalledOnce()
  })

  it('rejects when attached leads are not all owned', async () => {
    availableLeadIds = new Set<string>([LEAD_ID_1])
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Q2 Campaign', leadIds: [LEAD_ID_1, LEAD_ID_2] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns list with includeLeads query', async () => {
    mockCampaigns = [
      {
        id: 'campaign_1',
        workspace_id: 'ws_1',
        created_by: 'user_1',
        name: 'Pipeline Push',
        objective: null,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns?includeLeads=true', {
      method: 'GET',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.campaigns)).toBe(true)
  })
})
