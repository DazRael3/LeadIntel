// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import { vi } from 'vitest'

vi.mock('@/components/TopNav', () => ({
  TopNav: () => null,
}))

vi.mock('@/components/BrandHero', () => ({
  BrandHero: () => null,
}))

const trackMock = vi.fn()
vi.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
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
  beforeEach(() => {
    trackMock.mockClear()
  })

  it('anonymous visitor renders marketing content only', () => {
    render(<CompetitiveReportContent viewer={null} tier={null} latestPitch={null} />)

    expect(screen.getByRole('heading', { name: /competitive intelligence report/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up to try leadintel/i })).toBeInTheDocument()
    expect(screen.queryByText(/your latest leadintel report/i)).not.toBeInTheDocument()
  })

  it('logged-in starter with latest pitch shows teaser + upgrade CTA and deep-link', () => {
    render(
      <CompetitiveReportContent
        viewer={{ id: 'u1' }}
        tier="starter"
        latestPitch={{
          id: 'p1',
          companyName: 'Acme',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          previewBullets: ['Acme is expanding aggressively in APAC.', 'Competitors are reacting with pricing pressure.'],
          deepLinkHref: '/dashboard?company=acme.com',
        }}
      />
    )

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    expect(screen.getByText(/starter \(limited\)/i)).toBeInTheDocument()
    const card = within(screen.getByTestId('latest-report-card'))
    expect(card.getByTestId('report-teaser-masked')).toBeInTheDocument()
    expect(card.getByText(/upgrade to unlock full competitive analysis, trigger events, and account-ready email copy/i)).toBeInTheDocument()

    expect(card.getByRole('link', { name: /open limited report in dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard?company=acme.com'
    )
    expect(card.getByRole('link', { name: /view all reports/i })).toHaveAttribute('href', '/reports')
    expect(card.getByRole('link', { name: /view pricing & plans/i })).toHaveAttribute('href', '/pricing')
  })

  it('logged-in starter with no latest pitch shows empty state + pricing CTA', () => {
    render(<CompetitiveReportContent viewer={{ id: 'u1' }} tier="starter" latestPitch={null} />)

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    const card = within(screen.getByTestId('latest-report-card'))
    expect(card.getByText(/no report generated yet/i)).toBeInTheDocument()
    expect(card.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(card.getByRole('link', { name: /view pricing & plans/i })).toHaveAttribute('href', '/pricing')
  })

  it('logged-in closer with latest pitch shows full preview and no upgrade messaging', () => {
    render(
      <CompetitiveReportContent
        viewer={{ id: 'u1' }}
        tier="closer"
        latestPitch={{
          id: 'p1',
          companyName: 'Google',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          previewBullets: ['Google is accelerating AI feature delivery.', 'Key rivals are lagging in distribution.'],
          deepLinkHref: '/dashboard?company=google.com',
        }}
      />
    )

    expect(screen.getByText(/closer \(full access\)/i)).toBeInTheDocument()
    const card = within(screen.getByTestId('latest-report-card'))
    expect(card.getByTestId('latest-report-executive-label')).toBeInTheDocument()
    expect(card.getByTestId('latest-report-insights-label')).toBeInTheDocument()
    expect(card.getByRole('link', { name: /open full report in dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard?company=google.com'
    )
    expect(card.getByRole('link', { name: /view all reports/i })).toHaveAttribute('href', '/reports')
    expect(
      card.queryByText(/upgrade to unlock full competitive analysis, trigger events, and account-ready email copy/i)
    ).not.toBeInTheDocument()
    expect(card.getByRole('link', { name: /view all pitches/i })).toHaveAttribute('href', '/dashboard/history')
  })

  it('logged-in closer with no latest pitch shows empty state without pricing CTA', () => {
    render(<CompetitiveReportContent viewer={{ id: 'u1' }} tier="closer" latestPitch={null} />)

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    const card = within(screen.getByTestId('latest-report-card'))
    expect(card.getByText(/no report yet/i)).toBeInTheDocument()
    expect(card.getByRole('link', { name: /go to dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(card.queryByRole('link', { name: /view pricing & plans/i })).not.toBeInTheDocument()
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

  it('tracks view + clicks from latest report card (starter)', async () => {
    render(
      <CompetitiveReportContent
        viewer={{ id: 'u1' }}
        tier="starter"
        latestPitch={{
          id: 'p1',
          companyName: 'Acme',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          previewBullets: ['Acme is expanding aggressively in APAC.'],
          deepLinkHref: '/dashboard?company=acme.com',
        }}
      />
    )

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('competitive_report_view', { isLoggedIn: true, tier: 'starter' })
    )
    trackMock.mockClear()

    const card = within(screen.getByTestId('latest-report-card'))
    fireEvent.click(card.getByRole('link', { name: /open limited report in dashboard/i }))
    expect(trackMock).toHaveBeenCalledWith('competitive_report_open_dashboard', {
      tier: 'starter',
      companyName: 'Acme',
      reportId: 'p1',
    })

    trackMock.mockClear()
    fireEvent.click(card.getByRole('link', { name: /view pricing & plans/i }))
    expect(trackMock).toHaveBeenCalledWith('competitive_report_click_pricing', { tier: 'starter' })

    trackMock.mockClear()
    fireEvent.click(card.getByRole('link', { name: /view all reports/i }))
    expect(trackMock).toHaveBeenCalledWith('competitive_report_view_all_reports', { tier: 'starter' })
  })

  it('tracks view for anonymous visitors (best-effort)', async () => {
    render(<CompetitiveReportContent viewer={null} tier={null} latestPitch={null} />)
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('competitive_report_view', { isLoggedIn: false, tier: null })
    )
  })

  it('tracks open dashboard + view-all for closer', async () => {
    render(
      <CompetitiveReportContent
        viewer={{ id: 'u1' }}
        tier="closer"
        latestPitch={{
          id: 'p9',
          companyName: 'Google',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          previewBullets: ['Google is accelerating AI feature delivery.'],
          deepLinkHref: '/dashboard?company=google.com',
        }}
      />
    )

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('competitive_report_view', { isLoggedIn: true, tier: 'closer' })
    )
    trackMock.mockClear()

    const card = within(screen.getByTestId('latest-report-card'))
    fireEvent.click(card.getByRole('link', { name: /open full report in dashboard/i }))
    expect(trackMock).toHaveBeenCalledWith('competitive_report_open_dashboard', {
      tier: 'closer',
      companyName: 'Google',
      reportId: 'p9',
    })

    trackMock.mockClear()
    fireEvent.click(card.getByRole('link', { name: /view all reports/i }))
    expect(trackMock).toHaveBeenCalledWith('competitive_report_view_all_reports', { tier: 'closer' })
  })
})

