// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/contact',
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('LeadCaptureCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires valid email and consent before submit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { saved: true, deduped: false } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const { LeadCaptureCard } = await import('./LeadCaptureCard')
    render(<LeadCaptureCard surface="contact-test" intent="demo" />)

    const button = screen.getByRole('button', { name: /send request/i })
    const emailInput = screen.getByLabelText(/email/i)
    const consent = screen.getByLabelText(/i agree to be contacted about this request and product updates/i)

    expect(button).toBeDisabled()

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(consent)
    expect(button).toBeDisabled()

    fireEvent.change(emailInput, { target: { value: 'buyer@example.com' } })
    expect(button).not.toBeDisabled()

    fireEvent.click(button)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
