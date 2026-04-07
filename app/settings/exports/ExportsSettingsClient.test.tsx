// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportsSettingsClient } from './ExportsSettingsClient'

const toastMock = vi.fn()

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

describe('ExportsSettingsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders backend error state instead of empty state when jobs load fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to load exports' },
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch

    render(<ExportsSettingsClient />)

    await waitFor(() => {
      expect(screen.getByTestId('exports-jobs-error')).toBeInTheDocument()
    })
    expect(screen.queryByText('No export jobs yet.')).toBeNull()
    expect(screen.getByText('Failed to load exports')).toBeInTheDocument()
  })

  it('shows empty state only when jobs request succeeds with no jobs', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: { jobs: [] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch

    render(<ExportsSettingsClient />)

    await waitFor(() => {
      expect(screen.getByText('No export jobs yet.')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('exports-jobs-error')).toBeNull()
  })

  it('retries load when retry button is clicked', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'DATABASE_ERROR', message: 'Failed to load exports' },
          }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              jobs: [{ id: 'job_1', type: 'accounts', status: 'pending', created_at: new Date().toISOString(), ready_at: null, error: null }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<ExportsSettingsClient />)

    await waitFor(() => {
      expect(screen.getByTestId('exports-jobs-error')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByTestId('exports-jobs')).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
