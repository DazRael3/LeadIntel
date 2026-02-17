import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const getUserMock = vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null }))
const maybeSingleMock = vi.fn(async () => ({
  data: {
    phone: '+1 555 555 5555',
    preferred_contact_channel: 'email',
    preferred_contact_detail: 'u@example.com',
    allow_product_updates: true,
  },
  error: null,
}))
const selectMock = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })) }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: getUserMock },
    from: vi.fn(() => ({ select: selectMock })),
  }),
}))

describe('CommunicationPreferencesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads existing prefs and saves via /api/settings', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    } as any)

    const { CommunicationPreferencesCard } = await import('./CommunicationPreferencesCard')
    render(<CommunicationPreferencesCard />)

    await waitFor(() => expect(screen.getByText('Communication preferences')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByDisplayValue('+1 555 555 5555')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByDisplayValue('email')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+1 777 777 7777' } })
    fireEvent.change(screen.getByLabelText('Preferred channel'), { target: { value: 'slack' } })
    fireEvent.change(screen.getByLabelText('Contact detail'), { target: { value: '@me' } })
    fireEvent.click(screen.getByLabelText('Send me product updates and tips'))
    fireEvent.click(screen.getByText('Save preferences'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    fetchMock.mockRestore()
  })

  it('only fires analytics when NEXT_PUBLIC_ANALYTICS_ENABLED is true', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    } as any)

    // Disabled: should not call /api/analytics/track
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'false'
    const { CommunicationPreferencesCard } = await import('./CommunicationPreferencesCard')
    render(<CommunicationPreferencesCard />)
    await waitFor(() => expect(screen.getByText('Communication preferences')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Save preferences'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/analytics/track')).toBe(false)

    // Enabled: should call /api/analytics/track
    fetchMock.mockClear()
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = 'true'
    render(<CommunicationPreferencesCard />)
    await waitFor(() => expect(screen.getAllByText('Save preferences').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Save preferences')[0])
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/analytics/track')).toBe(true)

    fetchMock.mockRestore()
  })
})

