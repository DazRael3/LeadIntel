// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ReportsHubContent } from './ReportsHubContent'

describe('/reports hub content', () => {
  it('starter with >3 reports shows only 3 + upgrade CTA', () => {
    render(
      <ReportsHubContent
        tier="starter"
        reports={[
          { id: '1', companyName: 'A', createdAt: new Date('2026-01-04T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=a' },
          { id: '2', companyName: 'B', createdAt: new Date('2026-01-03T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=b' },
          { id: '3', companyName: 'C', createdAt: new Date('2026-01-02T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=c' },
          { id: '4', companyName: 'D', createdAt: new Date('2026-01-01T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=d' },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: /saved reports/i })).toBeInTheDocument()
    expect(screen.getByText(/you’re on the starter plan/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view pricing & plans/i })).toHaveAttribute('href', '/pricing')
    expect(screen.getAllByTestId('saved-report-row')).toHaveLength(3)
  })

  it('closer with >3 reports shows all and no upgrade CTA', () => {
    render(
      <ReportsHubContent
        tier="closer"
        reports={[
          { id: '1', companyName: 'A', createdAt: new Date('2026-01-04T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=a' },
          { id: '2', companyName: 'B', createdAt: new Date('2026-01-03T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=b' },
          { id: '3', companyName: 'C', createdAt: new Date('2026-01-02T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=c' },
          { id: '4', companyName: 'D', createdAt: new Date('2026-01-01T00:00:00Z'), previewBullets: ['x'], deepLinkHref: '/dashboard?company=d' },
        ]}
      />
    )

    expect(screen.getAllByTestId('saved-report-row')).toHaveLength(4)
    expect(screen.queryByText(/you’re on the starter plan/i)).not.toBeInTheDocument()
  })
})

