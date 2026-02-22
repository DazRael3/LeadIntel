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
        }}
      />
    )

    expect(screen.getByText(/your latest leadintel report/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open this report in your dashboard/i })
    expect(link.getAttribute('href') || '').toContain('/dashboard?company=acme.com')
  })
})

