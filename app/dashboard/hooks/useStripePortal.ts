'use client'

import { useCallback } from 'react'

interface UseStripePortalReturn {
  openPortal: () => Promise<void>
}

export function useStripePortal(): UseStripePortalReturn {
  const openPortal = useCallback(async () => {
    try {
      const resp = await fetch('/api/stripe/portal', { method: 'POST' })
      if (!resp.ok) return
      const text = await resp.text()
      if (!text || text.trim().length === 0) {
        console.error('Empty response from /api/stripe/portal')
        return
      }
      let data: { url?: string }
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error'
        console.error('JSON parse error in stripe portal:', parseError, 'Response text:', text.substring(0, 200))
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Stripe portal error:', err)
      // silent failure
    }
  }, [])

  return { openPortal }
}
