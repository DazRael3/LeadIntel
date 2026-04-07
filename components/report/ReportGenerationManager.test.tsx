// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { ReportGenerationManager } from './ReportGenerationManager'

let mockPathname = '/competitive-report'
let mockSearchParams = new URLSearchParams()
const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

describe('ReportGenerationManager auto generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockPathname = '/competitive-report'
    mockSearchParams = new URLSearchParams()
  })

  it('does not call generate API for invalid auto URL input', async () => {
    mockSearchParams = new URLSearchParams('auto=1&company=Acer&url=https%3A%2F%2Facer')
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<ReportGenerationManager />)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls generate API once for valid auto input', async () => {
    mockSearchParams = new URLSearchParams('auto=1&company=Viacom&url=viacom.com')
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: { reportId: 'rep_1' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<ReportGenerationManager />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const calls = fetchMock.mock.calls as Array<unknown[]>
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    const init = firstCall[1] as RequestInit | undefined
    const parsed = JSON.parse(String(init?.body)) as { input_url?: string | null }
    expect(parsed.input_url).toBe('https://viacom.com')
  })
})
