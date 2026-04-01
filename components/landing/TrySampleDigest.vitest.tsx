// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import { TrySampleDigest } from './TrySampleDigest'

describe('TrySampleDigest email-config caching', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('uses cached email-config and avoids a second fetch', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { enabled: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<TrySampleDigest />)

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    const callsAfterFirstMount = fetchSpy.mock.calls.length

    render(<TrySampleDigest />)

    await waitFor(() => {
      // Allow effects to run; cached path should not increase fetch calls.
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirstMount)
    })
  })
})

