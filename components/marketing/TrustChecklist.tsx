'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

const QUESTIONS = [
  'What data is stored, and what is explicitly out of scope?',
  'How is tenant/workspace access controlled?',
  'What audit visibility exists for team-governed workflows?',
  'How do exports and webhooks behave (and what is sent)?',
  'How are secrets handled (where do API keys live)?',
  'What rate limiting and abuse protections exist on public and auth routes?',
  'How can we request deletion or support escalation?',
  'What does LeadIntel not claim yet (so we don’t assume it)?',
] as const

export function TrustChecklist() {
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
        track('trust_readiness_viewed', { section: 'larger_team_questions' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">What larger teams usually ask about</CardTitle>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            Buyer readiness
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        <div>
          These questions map to how LeadIntel actually works in production: workspace isolation, access controls, and action delivery.
        </div>
        <ul className="list-disc pl-5 space-y-1">
          {QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

