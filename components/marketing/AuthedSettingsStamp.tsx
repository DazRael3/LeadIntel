'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'

export function AuthedSettingsStamp(props: {
  /** Settings payload to POST to /api/settings (best-effort). */
  payload: Record<string, unknown>
  /** Dedupe key for local sessionStorage (prevents rapid repeats). */
  sessionKey: string
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    try {
      const key = `leadintel:stamp:${props.sessionKey}`
      if (typeof window !== 'undefined') {
        const prev = window.sessionStorage.getItem(key)
        if (prev === '1') return
        window.sessionStorage.setItem(key, '1')
      }
    } catch {
      // ignore
    }

    ;(async () => {
      // Public request hygiene: only call /api/settings when authenticated.
      try {
        const supabase = createClient()
        const user = await getUserSafe(supabase)
        if (!user) return
      } catch {
        return
      }

      void fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props.payload),
        keepalive: true,
      }).catch(() => {})
    })()
  }, [props.payload, props.sessionKey])

  return null
}

