import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let mockGuardUserId: string | undefined = 'user_1'
let mockUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'team@example.com' }
let mockMembershipRole: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer' | null = 'owner'
let capabilityAllowed = true
let campaignOwnerId = 'user_1'

vi.mock('@/lib/api/guard', () => ({
  withApiGuard:
    (
      handler: (
        req: NextRequest,
        ctx: { requestId: string; userId?: string; body?: unknown }
      ) => Promise<Response> | Response
    ) =>
    async (req: NextRequest) =>
      handler(req, { requestId: 'req_1', userId: mockGuardUserId }),
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
  canManageCampaign: (role: string, createdBy: string, userId: string) =>
    role === 'owner' || role === 'admin' || role === 'manager' || (role === 'rep' && createdBy === userId),
  getCampaignById: vi.fn(async () => ({
    id: 'campaign_1',
    workspace_id: 'ws_1',
    created_by: campaignOwnerId,
    name: 'Pipeline Push',
    objective: null,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  listCampaignLeadJoins: vi.fn(async () => [
    { campaign_id: 'campaign_1', lead_id: 'lead_1', workspace_id: 'ws_1', added_by: 'user_1', created_at: new Date().toISOString() },
  ]),
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
}))

vi.mock('@/lib/exports/storage', () => ({
  uploadExportCsv: vi.fn(async () => ({ filePath: 'exports/ws_1/campaign.csv' })),
  getExportDownload: vi.fn(async () => ({ mode: 'signedUrl', url: 'https://download.example/campaign.csv' })),
}))

describe('/api/campaigns/[campaignId]/export', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGuardUserId = 'user_1'
    mockUser = { id: 'user_1', email: 'team@example.com' }
    mockMembershipRole = 'owner'
    capabilityAllowed = true
    campaignOwnerId = 'user_1'
  })

  it('returns export download URL when capability is granted', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1/export', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.downloadUrl).toBe('https://download.example/campaign.csv')
  })

  it('returns 403 when export capability is blocked', async () => {
    capabilityAllowed = false
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1/export', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(403)
  })

  it('returns 403 for rep users exporting campaigns they do not own', async () => {
    mockMembershipRole = 'rep'
    campaignOwnerId = 'other_user'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/campaigns/campaign_1/export', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req, { params: Promise.resolve({ campaignId: '247f89b6-0ff6-4f8a-9f89-fa3e0c8b4ac4' }) })
    expect(res.status).toBe(403)
  })
})
