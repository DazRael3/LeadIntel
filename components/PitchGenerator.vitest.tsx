// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockGetUser = vi.fn()
const mockOnAuth = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuth,
    },
    from: mockFrom,
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { PitchGenerator } from './PitchGenerator'

function okLatest(content: string) {
  return {
    ok: true,
    data: {
      pitch: {
        pitchId: 'p1',
        createdAt: '2025-01-01T00:00:00Z',
        content,
        company: {
          leadId: 'l1',
          companyName: 'TestCo',
          companyDomain: 'test.co',
          companyUrl: 'https://test.co',
          emailSequence: { part1: 'P1', part2: 'P2', part3: 'P3' },
          battleCard: { currentTech: ['A'], painPoint: 'B', killerFeature: 'C' },
        },
      },
    },
  }
}

describe('PitchGenerator latest pitch hydration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    window.localStorage.clear()
    window.sessionStorage.clear()

    mockGetUser.mockResolvedValue({ data: { user: { id: 'test-user-id', email: 't@example.com' } }, error: null })
    mockOnAuth.mockReturnValue({ data: { subscription: { unsubscribe: () => {} } } })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { subscription_tier: 'pro' }, error: null }) }) }),
        }
      }
      if (table === 'user_settings') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { saved_companies: [] }, error: null }) }) }),
          upsert: async () => ({ data: null, error: null }),
        }
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    })
  })

  it('hydrates and renders latest pitch on initial load when initialUrl set', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.startsWith('/api/pitch/latest')) {
        return { ok: true, json: async () => okLatest('Saved pitch text') } as any
      }
      return { ok: true, json: async () => ({ ok: true, data: {} }) } as any
    })

    render(<PitchGenerator initialUrl="test.co" />)
    await waitFor(() => expect(screen.getByText('Generated Pitch')).toBeInTheDocument())
    expect(screen.getByText(/Saved pitch text/)).toBeInTheDocument()
  })

  it('clicking a saved company chip hydrates that company latest pitch', async () => {
    window.localStorage.setItem('leadintel_saved_companies_test-user-id', JSON.stringify(['test.co', 'acme.com']))
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('/api/pitch/latest')) {
        if (url.includes('companyDomain=acme.com')) {
          return { ok: true, json: async () => okLatest('Acme pitch') } as any
        }
        return { ok: true, json: async () => okLatest('Test pitch') } as any
      }
      return { ok: true, json: async () => ({ ok: true, data: {} }) } as any
    })

    render(<PitchGenerator initialUrl="test.co" />)
    await waitFor(() => expect(screen.getByText('Generated Pitch')).toBeInTheDocument())
    expect(screen.getByText(/Test pitch/)).toBeInTheDocument()

    const acmeChip = await screen.findByRole('button', { name: 'acme.com' })
    fireEvent.click(acmeChip)

    await waitFor(() => expect(screen.getByText(/Acme pitch/)).toBeInTheDocument())
  })
})

