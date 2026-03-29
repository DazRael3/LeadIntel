'use client'

import { useCallback, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

type StepId = 'detect' | 'prioritize' | 'explain' | 'draft' | 'push_export'

type Step = {
  id: StepId
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 'detect', title: 'Detect fresh signals', description: 'Capture why-now context from internal and external sources (when available).' },
  { id: 'prioritize', title: 'Prioritize today’s accounts', description: 'Turn signals into a ranked shortlist so reps don’t hunt in tabs.' },
  { id: 'explain', title: 'Explain the score', description: 'Show the reasons behind the 0–100 score so prioritization is trustworthy.' },
  { id: 'draft', title: 'Draft the message', description: 'Generate send-ready openers and sequences without a blank page.' },
  { id: 'push_export', title: 'Push or export the action', description: 'Route work via webhooks or exports to fit the team’s operating system.' },
]

export function WorkflowRail() {
  const [active, setActive] = useState<StepId>('detect')
  const activeIdx = useMemo(() => STEPS.findIndex((s) => s.id === active), [active])

  const onSelect = useCallback((id: StepId) => {
    setActive(id)
    track('marketing_workflow_rail_interacted', { step: id })
  }, [])

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">How LeadIntel works</CardTitle>
          <Badge
            variant="outline"
            className="border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300"
          >
            Signal-based outbound platform
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          A daily loop that turns timing into action—shortlist, explainability, and send-ready outreach.
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {STEPS.map((s, idx) => {
            const isActive = s.id === active
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                className={
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors ' +
                  (isActive
                    ? 'border-cyan-500/30 bg-cyan-500/10'
                    : 'border-cyan-500/10 bg-background/30 hover:bg-cyan-500/5')
                }
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">{`${idx + 1}) ${s.title}`}</div>
                  {isActive ? <CheckCircle2 className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> : null}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border border-cyan-500/10 bg-background/40 p-4 lg:col-span-2">
          <div className="text-xs text-muted-foreground">Active step</div>
          <div className="mt-1 text-base font-semibold text-foreground">{STEPS[activeIdx]?.title}</div>
          <div className="mt-2 text-sm text-muted-foreground">{STEPS[activeIdx]?.description}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">Daily shortlist</Badge>
            <Badge variant="outline">Explainable score</Badge>
            <Badge variant="outline">Why-now intelligence</Badge>
            <Badge variant="outline">Account planning</Badge>
            <Badge variant="outline">Send-ready outreach</Badge>
            <Badge variant="outline">Action layer</Badge>
            <Badge variant="outline">Privacy-safe benchmarks</Badge>
            <Badge variant="outline">Multi-workspace ops</Badge>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onSelect(STEPS[Math.max(0, activeIdx - 1)]!.id)}
              disabled={activeIdx <= 0}
            >
              Back
            </Button>
            <Button
              className="neon-border hover:glow-effect"
              onClick={() => onSelect(STEPS[Math.min(STEPS.length - 1, activeIdx + 1)]!.id)}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

