'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function StatusAutoRefresh() {
  const router = useRouter()

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const id = window.setInterval(() => router.refresh(), 60_000)
    return () => window.clearInterval(id)
  }, [router])

  return null
}

