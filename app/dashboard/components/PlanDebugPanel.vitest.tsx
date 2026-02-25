// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PlanDebugPanel } from './PlanDebugPanel'

const planMock: { tier: 'starter' | 'closer'; planId: string | null; isHouseCloserOverride: boolean } = {
  tier: 'starter',
  planId: null,
  isHouseCloserOverride: false,
}

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => planMock,
}))

describe('PlanDebugPanel', () => {
  it('starter does not render', () => {
    planMock.tier = 'starter'
    planMock.planId = null
    planMock.isHouseCloserOverride = false
    render(<PlanDebugPanel />)
    expect(screen.queryByText(/plan debug/i)).not.toBeInTheDocument()
  })

  it('normal closer does not render', () => {
    planMock.tier = 'closer'
    planMock.planId = 'pro'
    planMock.isHouseCloserOverride = false
    render(<PlanDebugPanel />)
    expect(screen.queryByText(/plan debug/i)).not.toBeInTheDocument()
  })

  it('house closer renders and links to /api/plan', () => {
    planMock.tier = 'closer'
    planMock.planId = 'pro'
    planMock.isHouseCloserOverride = true
    render(<PlanDebugPanel />)
    expect(screen.getByText(/plan debug \(house closer\)/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open \/api\/plan/i })).toHaveAttribute('href', '/api/plan')
  })
})

