// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockFrom = vi.fn()
const mockChannel = vi.fn()
const mockRemoveChannel = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  })),
}))

import { WebsiteVisitors } from './WebsiteVisitors'

describe('WebsiteVisitors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: empty visitor list
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })
    mockChannel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({})),
    })
  })

  it('renders empty state when there are no visitors', async () => {
    render(<WebsiteVisitors />)
    await waitFor(() => expect(screen.getByText(/no visitors tracked yet/i)).toBeInTheDocument())
    expect(screen.getByText(/how to set this up/i)).toBeInTheDocument()
  })
})

