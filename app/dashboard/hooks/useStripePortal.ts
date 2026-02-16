'use client'

import { useCallback } from 'react'

interface UseStripePortalReturn {
  openPortal: () => Promise<void>
}

export function useStripePortal(): UseStripePortalReturn {
  const openPortal = useCallback(async () => {
    try {
      const resp = await fetch('/api/billing/portal', { method: 'POST' })
      if (!resp.ok) return
      const data = (await resp.json()) as { url?: string }
      if (data?.url) window.location.href = data.url
    } catch (err) {
      console.error('Stripe portal error:', err)
      // silent failure
    }
  }, [])

  return { openPortal }
}
