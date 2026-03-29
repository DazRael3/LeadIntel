'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

type Story = {
  title: string
  from: string
  to: string
  notes: string[]
}

const STORIES: Story[] = [
  {
    title: 'From spreadsheet + Google Alerts to daily shortlist',
    from: 'Tracking targets manually and reacting to noisy alerts.',
    to: 'A short list of accounts to action today, with reasons and drafts.',
    notes: ['Start with a defined watchlist.', 'Run the loop daily: shortlist → explain → draft → action.'],
  },
  {
    title: 'From broad databases to timing-first prioritization',
    from: 'Lots of accounts and contacts, but unclear timing.',
    to: 'A “why now” workflow that helps reps act while signals are fresh.',
    notes: ['Keep your database if you like it.', 'Use LeadIntel to decide who deserves outreach today.'],
  },
  {
    title: 'From manual research to send-ready outreach',
    from: 'Tabs, notes, and blank-page writing before every touch.',
    to: 'Signal-grounded messaging directions and reusable templates.',
    notes: ['Save briefs/outputs so you don’t restart each time.', 'Use persona-level angles when contact data is thin.'],
  },
  {
    title: 'From one-off rep work to shared team playbooks',
    from: 'Great reps are consistent; everyone else improvises.',
    to: 'Shared templates with approvals + audit visibility + operational handoff.',
    notes: ['Draft → approve → reuse across reps.', 'Use exports/webhooks to fit your operating system.'],
  },
]

export function MigrationStories() {
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
        track('migration_story_viewed', { section: 'common_switching_paths' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="space-y-4">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Common switching paths</CardTitle>
            <Badge variant="outline" className="li-chip">
              Patterns, not case studies
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          These are common workflow shifts we see when teams adopt a timing-first outbound loop. They’re not customer stories.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {STORIES.map((s) => (
          <Card key={s.title} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">From</div>
                <div className="mt-1">{s.from}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">To</div>
                <div className="mt-1">{s.to}</div>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {s.notes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

