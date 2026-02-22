// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { vi } from 'vitest'

vi.mock('@/components/TopNav', () => ({
  TopNav: () => null,
}))

vi.mock('@/components/BrandHero', () => ({
  BrandHero: () => null,
}))

import { CompetitiveReportContent } from './CompetitiveReportContent'
import { loadCompetitiveReportPageData } from './loadCompetitiveReportPageData'

const createClientMock = vi.fn()
const getPlanDetailsMock = vi.fn()
const getLatestPitchSummaryForUserMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClientMock(),
}))

vi.mock('@/lib/billing/plan', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/plan')>('@/lib/billing/plan')
  return {
    ...actual,
    getPlanDetails: (...args: unknown[]) => getPlanDetailsMock(...args),
  }
})

vi.mock('@/lib/services/pitchesLatest', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services/pitchesLatest')>('@/lib/services/pitchesLatest')
  return {
    ...actual,
    getLatestPitchSummaryForUser: (...args: unknown[]) => getLatestPitchSummaryForUserMock(...args),
  }
})

describe('/competitive-report page', () => {
  it('anonymous visitor renders marketing content only', () => {
    render(<CompetitiveReportContent viewer={null} tier={null} latestPitch={null} />)

    expect(screen.getByRole('heading', { name: /competitive intelligence report/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up to try leadintel/i })).toBeInTheDocument()
    expect(screen.queryByText(/your latest leadintel report/i)).not.toBeInTheDocument()
  })

  it('logged-in user with no latest pitch renders empty-state CTA', () => {
    render(<CompetitiveReportContent viewer={{ id: 'u1' }} tier="starter" latestPitch={null} />)

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    expect(screen.getByText(/you haven’t generated a competitive report yet/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /go to dashboard to generate your first report/i })
    ).toHaveAttribute('href', '/dashboard')
  })

  it('logged-in user with a latest pitch renders deep-link to dashboard company', () => {
    render(
      <CompetitiveReportContent
        viewer={{ id: 'u1' }}
        tier="closer"
        latestPitch={{
          id: 'p1',
          companyName: 'Acme',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          previewBullets: ['Subject: Intro', 'Line two', 'Line three'],
          deepLinkHref: '/dashboard?company=acme.com',
        }}
      />
    )

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open this report in your dashboard/i })
    expect(link.getAttribute('href') || '').toContain('/dashboard?company=acme.com')
  })

  it('loader returns anonymous when no user', async () => {
    createClientMock.mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const res = await loadCompetitiveReportPageData()
    expect(res.user).toBeNull()
    expect(res.tier).toBeNull()
    expect(res.latestPitch).toBeNull()
  })

  it('loader returns tier + latest pitch for signed-in user', async () => {
    createClientMock.mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } }) },
    })
    getPlanDetailsMock.mockResolvedValueOnce({ plan: 'free' })
    getLatestPitchSummaryForUserMock.mockResolvedValueOnce({
      id: 'p1',
      companyName: 'Google',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      previewBullets: [],
      deepLinkHref: '/dashboard?company=google.com',
    })

    const res = await loadCompetitiveReportPageData()
    expect(res.user?.id).toBe('u1')
    expect(res.tier).toBe('starter')
    expect(res.latestPitch?.companyName).toBe('Google')
    expect(res.latestPitch?.deepLinkHref).toContain('/dashboard?company=')
  })
})

