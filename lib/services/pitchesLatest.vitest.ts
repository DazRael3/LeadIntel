import { describe, expect, it, vi } from 'vitest'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getLatestPitchSummaryForUser } from './pitchesLatest'

const getLatestPitchForUserMock = vi.fn()

vi.mock('@/lib/services/pitches', () => ({
  getLatestPitchForUser: (...args: unknown[]) => getLatestPitchForUserMock(...args),
}))

describe('getLatestPitchSummaryForUser', () => {
  it('returns null when there are no pitches', async () => {
    getLatestPitchForUserMock.mockResolvedValueOnce(null)
    const supabase = {} as unknown as SupabaseClient
    const res = await getLatestPitchSummaryForUser(supabase, 'u1')
    expect(res).toBeNull()
  })

  it('returns latest pitch summary and a dashboard deep-link', async () => {
    getLatestPitchForUserMock.mockResolvedValueOnce({
      pitchId: 'p1',
      createdAt: '2026-01-01T00:00:00.000Z',
      content: 'Subject: Intro\nLine two\nLine three',
      company: {
        leadId: 'l1',
        companyName: 'Acme',
        companyDomain: 'acme.com',
        companyUrl: 'https://acme.com',
        emailSequence: null,
        battleCard: null,
      },
    })
    const supabase = {} as unknown as SupabaseClient
    const res = await getLatestPitchSummaryForUser(supabase, 'u1')
    expect(res).not.toBeNull()
    expect(res?.id).toBe('p1')
    expect(res?.companyName).toBe('Acme')
    expect(res?.deepLinkHref).toContain('/dashboard?company=acme.com')
    expect(res?.previewBullets.length).toBeGreaterThan(0)
  })
})

