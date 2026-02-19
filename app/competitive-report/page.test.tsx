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

import CompetitiveReportPage from './page'

describe('/competitive-report page', () => {
  it('renders the competitive report headline and CTA', () => {
    render(<CompetitiveReportPage />)

    expect(screen.getByRole('heading', { name: /competitive intelligence report/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up to try leadintel/i })).toBeInTheDocument()
  })
})

