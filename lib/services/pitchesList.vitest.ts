import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { listSavedReportsForUser } from './pitchesList'

function makeSupabaseMock(rows: unknown[], error: unknown = null): SupabaseClient {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: vi.fn(() => Promise.resolve({ data: rows, error })),
  }
  return {
    from: () => chain,
  } as unknown as SupabaseClient
}

describe('listSavedReportsForUser', () => {
  it('returns empty array when no pitches', async () => {
    const supabase = makeSupabaseMock([])
    const res = await listSavedReportsForUser(supabase, 'u1', { limit: 10 })
    expect(res).toEqual([])
  })

  it('orders newest first (respects created_at desc ordering) and builds deepLinkHref', async () => {
    const rows = [
      {
        id: 'p2',
        lead_id: 'l2',
        content: 'Newest\nLine2',
        created_at: '2026-01-02T00:00:00Z',
        leads: { company_domain: 'acme.com', company_name: 'Acme', company_url: 'https://acme.com' },
      },
      {
        id: 'p1',
        lead_id: 'l1',
        content: 'Older',
        created_at: '2026-01-01T00:00:00Z',
        leads: { company_domain: 'older.com', company_name: 'OlderCo', company_url: 'https://older.com' },
      },
    ]
    const supabase = makeSupabaseMock(rows)
    const res = await listSavedReportsForUser(supabase, 'u1', { limit: 10 })
    expect(res.map((r) => r.id)).toEqual(['p2', 'p1'])
    expect(res[0]?.deepLinkHref).toBe('/dashboard?company=acme.com')
  })

  it('falls back to companyName when domain missing for deep link key', async () => {
    const rows = [
      {
        id: 'p1',
        lead_id: 'l1',
        content: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
        leads: { company_domain: null, company_name: 'Redpath', company_url: null },
      },
    ]
    const supabase = makeSupabaseMock(rows)
    const res = await listSavedReportsForUser(supabase, 'u1', { limit: 10 })
    expect(res[0]?.deepLinkHref).toBe('/dashboard?company=Redpath')
  })
})

