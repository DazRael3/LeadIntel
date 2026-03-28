// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import { AutoGenerateReportClient } from './AutoGenerateReportClient'

const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () =>
    ({
      get: (k: string) => {
        if (k === 'auto') return '1'
        if (k === 'id') return null
        if (k === 'company') return 'Acme'
        if (k === 'url') return 'https://acme.com'
        return null
      },
    }) as unknown as URLSearchParams,
}))

const toastMock = vi.fn((..._args: unknown[]) => ({ dismiss: vi.fn(), update: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}))

describe('AutoGenerateReportClient', () => {
  beforeEach(() => {
    pushMock.mockClear()
    refreshMock.mockClear()
    toastMock.mockClear()
  })

  it('auto-generates when auto=1 and no id, then navigates to report id', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true, data: { reportId: 'r1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    render(<AutoGenerateReportClient />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall).toBeTruthy()
    expect(String(firstCall?.[0])).toBe('/api/competitive-report/generate')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/competitive-report?id=r1'))
  })
})

