// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryClient } from './HistoryClient'

describe('HistoryClient gating', () => {
  it('shows lock state when pitch history access is disabled', () => {
    render(<HistoryClient initialLeads={[]} canAccessPitchHistory={false} canExportLeads={false} />)
    expect(screen.getByText(/save and reuse outputs/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /upgrade to closer/i })[0]).toHaveAttribute('href', '/pricing?target=closer')
  })
})

