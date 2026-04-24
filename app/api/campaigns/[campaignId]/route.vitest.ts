import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let mockGuardUserId: string | undefined = 'user_1'
let mockUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'team@example.com' }
let mockMembershipRole: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer' | null = 'owner'
let capabilityAllowed = true
let detachCount = 0
let attachCount = 0

const campaignRow = {
  id: 'campaign_1',
  workspace_id: 'ws_1',
  created_by: 'user_1',
  name: 'Pipeline Push',
  objective: null,
  status: 'draft',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

vi.mock('@/lib/api/guard', () => ({
  withApiGuard:
    (
      handler: (
        req: NextRequest,
        ctx: { requestId: string; userId?: string; body?: unknown }
      ) => Promise<Response> | Response
    ) =>
    async (req: NextRequest) => {
      const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.json()
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
  getCurrentWorkspace: vi.fn(async () => ({ id: 'ws_1', name: 'Workspace', owner_user_id: 'user_1' })),
  getWorkspaceMembership: vi.fn(async () => (mockMembershipRole ? { role: mockMembershipRole } : null)),
}))

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: capabilityAllowed, tier: capabilityAllowed ? 'team' : 'starter' })),
}))

vi.mock('@/lib/services/campaigns', () => ({
  CampaignAttachLeadsSchema: {
    shape: {
      leadIds: ['lead_1'],
    },
  },
  CampaignDetachLeadSchema: {
    shape: {
      leadId: 'lead_1',
    },
  },
  CampaignUpdateSchema: {
    refine: () => ({
      safeParse: (value: unknown) => {
        const patch = value as { name?: unknown; objective?: unknown; status?: unknown }
        if (!patch || typeof patch !== 'object') {
          return { success: false, error: { flatten: () => ({ fieldErrors: { root: ['Invalid payload'] } }) } }
        }
        const out: Record<string, unknown> = {}
        if (typeof patch.name === 'string') out.name = patch.name
        if (typeof patch.objective === 'string' || patch.objective === null) out.objective = patch.objective
        if (typeof patch.status === 'string') out.status = patch.status
        if (Object.keys(out).length === 0) {
          return { success: false, error: { flatten: () => ({ fieldErrors: { root: ['At least one field'] } }) } }
        }
        return { success: true, data: out }
      },
    }),
  },
  canManageCampaign: (role: string, createdBy: string, userId: string) =>
    role === 'owner' || role === 'admin' || role === 'manager' || (role === 'rep' && createdBy === userId),
  detachLeadFromCampaign: vi.fn(async () => {
    detachCount += 1
  }),
  getCampaignById: vi.fn(async () => campaignRow),
  getOwnedLeadRows: vi.fn(async ({ leadIds }: { leadIds: string[] }) =>
    leadIds.map((id) => ({
      id,
      company_name: `Company ${id}`,
      company_domain: `${id}.example.com`,
      company_url: `https://${id}.example.com`,
      prospect_email: `${id}@example.com`,
      ai_personalized_pitch: null,
      created_at: new Date().toISOString(),
    }))
  ),
  listCampaignLeadJoins: vi.fn(async () => [
    { campaign_id: 'campaign_1', lead_id: 'lead_1', workspace_id: 'ws_1', added_by: 'user_1', created_at: new Date().toISOString() },
  ]),
  updateCampaignRecord: vi.fn(async ({ patch }: { patch: Record<string, unknown> }) => ({ ...campaignRow, ...patch })),
  deleteCampaignRecord: vi.fn(async () => ({})),
  attachLeadsToCampaign: vi.fn(async () => {
    attachCount += 1
  }),
}))

describe('/api/campaigns/[campaignId]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGuardUserId = 'user_1'
    mockUser = { id: 'user_1', email: 'team@example.com' }
    mockMembershipRole = 'owner'
    capabilityAllowed = true
    detachCount = 0
    attachCount = 0
  })

  it('returns campaign details on GET', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1', {
      method: 'GET',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await GET(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.campaign?.id).toBe('campaign_1')
  })

  it('updates campaign status with PATCH', async () => {
    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ status: 'active' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.campaign?.status).toBe('active')
  })

  it('attaches leads with POST action', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ action: 'attach_leads', leadIds: ['lead_1'] }),
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.attached).toBe(1)
    expect(attachCount).toBeGreaterThan(0)
  })

  it('detaches a lead with POST action', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ action: 'detach_lead', leadId: 'lead_1' }),
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.detached).toBe(true)
    expect(detachCount).toBeGreaterThan(0)
  })

  it('returns 400 for legacy export action endpoint', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ action: 'export' }),
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(400)
  })

  it('blocks export route when capability gate fails', async () => {
    capabilityAllowed = false
    const { POST } = await import('./export/route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(403)
  })
})
