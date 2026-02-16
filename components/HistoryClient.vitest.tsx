// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoryClient } from './HistoryClient'

describe('HistoryClient gating', () => {
  it('shows lock state when pitch history access is disabled', () => {
    render(<HistoryClient initialLeads={[]} canAccessPitchHistory={false} canExportLeads={false} />)
    expect(screen.getByText(/trial work is safely stored/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).toBeInTheDocument()
  })
})

