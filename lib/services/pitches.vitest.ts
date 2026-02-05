import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getLatestPitchForCompany } from './pitches'

function makeSupabaseMock(rows: unknown[], error: unknown = null): SupabaseClient {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    ilike: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: rows, error }),
  }
  return {
    from: () => chain,
  } as unknown as SupabaseClient
}

describe('getLatestPitchForCompany', () => {
  it('returns null when neither domain nor name provided', async () => {
    const supabase = makeSupabaseMock([])
    const res = await getLatestPitchForCompany(supabase, { userId: 'u1' })
    expect(res).toBe(null)
  })

  it('prefers domain filter when provided', async () => {
    const chain: any = {}
    const eqSpy = vi.fn(() => chain)
    Object.assign(chain, {
      select: () => chain,
      eq: eqSpy,
      ilike: () => chain,
      order: () => chain,
      limit: () =>
        Promise.resolve({
          data: [
            {
              id: 'p1',
              lead_id: 'l1',
              content: 'hello',
              created_at: '2025-01-01T00:00:00Z',
              leads: { company_domain: 'bell.ca', company_name: 'Bell', company_url: 'https://bell.ca' },
            },
          ],
          error: null,
        }),
    })
    const supabase = { from: () => chain } as unknown as SupabaseClient
    const res = await getLatestPitchForCompany(supabase, { userId: 'u1', companyDomain: 'Bell.ca' })
    expect(eqSpy).toHaveBeenCalledWith('leads.company_domain', 'bell.ca')
    expect(res?.content).toBe('hello')
  })

  it('falls back to case-insensitive name match when no domain', async () => {
    const ilikeSpy = vi.fn(() => chain)
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      ilike: ilikeSpy,
      order: () => chain,
      limit: () => Promise.resolve({ data: [], error: null }),
    }
    const supabase = { from: () => chain } as unknown as SupabaseClient
    await getLatestPitchForCompany(supabase, { userId: 'u1', companyName: 'Acme' })
    expect(ilikeSpy).toHaveBeenCalled()
  })

  it('supports name-only lookups passed via companyDomain by checking name-key first', async () => {
    const chain: any = {}
    const eqSpy = vi.fn(() => chain)
    const ilikeSpy = vi.fn(() => chain)

    // First query (name-key) returns a match.
    Object.assign(chain, {
      select: () => chain,
      eq: eqSpy,
      ilike: ilikeSpy,
      order: () => chain,
      limit: () =>
        Promise.resolve({
          data: [
            {
              id: 'p1',
              lead_id: 'l1',
              content: 'hello',
              created_at: '2025-01-01T00:00:00Z',
              leads: { company_domain: 'name__redpath', company_name: 'Redpath', company_url: 'Redpath' },
            },
          ],
          error: null,
        }),
    })
    const supabase = { from: () => chain } as unknown as SupabaseClient
    const res = await getLatestPitchForCompany(supabase, { userId: 'u1', companyDomain: 'Redpath' })
    // Should attempt key lookup for name-only companyDomain.
    expect(eqSpy).toHaveBeenCalledWith('leads.company_domain', 'name__redpath')
    expect(res?.content).toBe('hello')
    // Should not need the name ilike fallback when key hits.
    expect(ilikeSpy).not.toHaveBeenCalled()
  })

  it('when companyDomain is already a name-key, the derived key path is preferred (no ilike fallback)', async () => {
    const chain: any = {}
    const eqSpy = vi.fn(() => chain)
    const ilikeSpy = vi.fn(() => chain)

    Object.assign(chain, {
      select: () => chain,
      eq: eqSpy,
      ilike: ilikeSpy,
      order: () => chain,
      limit: () =>
        Promise.resolve({
          data: [
            {
              id: 'p1',
              lead_id: 'l1',
              content: 'hello',
              created_at: '2025-01-01T00:00:00Z',
              leads: { company_domain: 'name__name-redpath', company_name: 'Redpath', company_url: 'Redpath' },
            },
          ],
          error: null,
        }),
    })

    const supabase = { from: () => chain } as unknown as SupabaseClient
    const res = await getLatestPitchForCompany(supabase, { userId: 'u1', companyDomain: 'name__redpath' })

    // Current behavior: since companyDomain does not look like a real domain, we derive a name-key from it.
    expect(eqSpy).toHaveBeenCalledWith('leads.company_domain', 'name__name-redpath')
    expect(res?.content).toBe('hello')
    expect(ilikeSpy).not.toHaveBeenCalled()
  })

  it('when companyDomain is a plain string and name-key lookup yields no match, falls back to ilike(company_name)', async () => {
    const chain: any = {}
    const eqSpy = vi.fn(() => chain)
    const ilikeSpy = vi.fn(() => chain)
    const limitSpy = vi
      .fn()
      // First call: name-key lookup => no rows
      .mockResolvedValueOnce({ data: [], error: null })
      // Second call: ilike fallback => a row
      .mockResolvedValueOnce({
        data: [
          {
            id: 'p2',
            lead_id: 'l2',
            content: 'from-ilike',
            created_at: '2025-01-02T00:00:00Z',
            leads: { company_domain: 'name__redpath', company_name: 'Redpath', company_url: 'Redpath' },
          },
        ],
        error: null,
      })

    Object.assign(chain, {
      select: () => chain,
      eq: eqSpy,
      ilike: ilikeSpy,
      order: () => chain,
      limit: limitSpy,
    })

    const supabase = { from: () => chain } as unknown as SupabaseClient
    const res = await getLatestPitchForCompany(supabase, { userId: 'u1', companyDomain: 'redpath' })
    expect(res?.content).toBe('from-ilike')
    expect(ilikeSpy).toHaveBeenCalled()
  })
})

