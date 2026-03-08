'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { track } from '@/lib/analytics'

const CARDS = [
  {
    title: 'Faster than broad platforms',
    body: 'Start with today’s shortlist instead of another dashboard full of noise.',
  },
  {
    title: 'Clearer than black-box scoring',
    body: 'Every score is grounded in visible inputs like ICP fit, recency, and signal strength.',
  },
  {
    title: 'More actionable than alert-only tools',
    body: 'Signals end in send-ready outreach, not a list of tabs for reps to open later.',
  },
  {
    title: 'Easier to evaluate than demo-only products',
    body: 'Generate a sample digest without signup and understand the workflow before you buy.',
  },
] as const

export function WhySwitchCards() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('proof_section_viewed', { section: 'why_switch_cards' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {CARDS.map((c) => (
        <Card key={c.title} className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{c.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{c.body}</CardContent>
        </Card>
      ))}
    </div>
  )
}

