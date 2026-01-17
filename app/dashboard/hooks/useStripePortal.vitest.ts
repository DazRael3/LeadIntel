import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStripePortal } from './useStripePortal'

// Mock window.location
const mockLocation = { href: '' }
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

describe('useStripePortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.href = ''
    global.fetch = vi.fn()
  })

  it('should open portal with valid URL', async () => {
    const mockResponse = { url: 'https://billing.stripe.com/test' }
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    } as Response)

    const { result } = renderHook(() => useStripePortal())

    await result.current.openPortal()

    expect(mockLocation.href).toBe('https://billing.stripe.com/test')
  })

  it('should handle empty response gracefully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useStripePortal())

    await result.current.openPortal()

    expect(mockLocation.href).toBe('')
    expect(consoleSpy).toHaveBeenCalledWith('Empty response from /api/stripe/portal')

    consoleSpy.mockRestore()
  })

  it('should handle invalid JSON gracefully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      text: async () => 'invalid json',
    } as Response)

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useStripePortal())

    await result.current.openPortal()

    expect(mockLocation.href).toBe('')
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('should handle fetch errors gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useStripePortal())

    await result.current.openPortal()

    expect(mockLocation.href).toBe('')
    expect(consoleSpy).toHaveBeenCalledWith('Stripe portal error:', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('should handle non-ok responses', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() => useStripePortal())

    await result.current.openPortal()

    expect(mockLocation.href).toBe('')
  })
})
