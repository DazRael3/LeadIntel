'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, ListChecks } from 'lucide-react'
import type { SignalEvent, SignalMomentum, ScoreExplainability } from '@/lib/domain/explainability'
import type { DataQualitySummary } from '@/lib/domain/data-quality'
import type { SourceHealthSummary } from '@/lib/domain/source-health'
import { MobileSignalsSummary } from '@/components/mobile/MobileSignalsSummary'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function whyNowFallback(args: { company: string; triggerEvent: string | null; topSignal: string | null; momentum: SignalMomentum | null }): string {
  const parts: string[] = []
  if (args.triggerEvent) parts.push(args.triggerEvent)
  if (args.topSignal) parts.push(args.topSignal)
  const mom = args.momentum?.label ? `Momentum: ${args.momentum.label}` : null
  if (mom) parts.push(mom)
  if (parts.length === 0) return `Review ${args.company} — no recent signals are available yet.`
  return `Review ${args.company}: ${parts.slice(0, 2).join(' · ')}${args.momentum ? ` · Momentum: ${args.momentum.label}` : ''}`
}

export function MobileAccountTriage(props: {
  companyName: string
  triggerEvent: string | null
  pitchText: string
  scoreExplainability: ScoreExplainability | null
  momentum: SignalMomentum | null
  dataQuality: DataQualitySummary | null
  sourceHealth: SourceHealthSummary | null
  signals: SignalEvent[]
  onOpenQueue?: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const topSignal = useMemo(() => (props.signals[0]?.title ?? null), [props.signals])
  const whyNow = useMemo(() => whyNowFallback({ company: props.companyName, triggerEvent: props.triggerEvent, topSignal, momentum: props.momentum }), [
    props.companyName,
    props.momentum,
    props.triggerEvent,
    topSignal,
  ])

  return (
    <div className="md:hidden rounded border border-cyan-500/20 bg-card/50 p-3 space-y-3" data-testid="mobile-account-triage">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">Triage</div>
          <div className="mt-1 text-xs text-muted-foreground">{whyNow}</div>
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setSheetOpen(true)}>
          Quick actions
        </Button>
      </div>

      <MobileSignalsSummary momentum={props.momentum} dataQuality={props.dataQuality} sourceHealth={props.sourceHealth} signals={props.signals} />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={async () => {
            const ok = await copyToClipboard(whyNow)
            // lightweight feedback only; avoids toast dependency in a modal
            if (!ok) setSheetOpen(true)
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy triage summary
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={props.onOpenQueue}>
          <ListChecks className="h-4 w-4 mr-2" />
          Open actions
        </Button>
      </div>

      <MobileActionSheet open={sheetOpen} title="Quick actions" onClose={() => setSheetOpen(false)}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Copy</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={async () => {
                  await copyToClipboard(whyNow)
                  setSheetOpen(false)
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy triage summary
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={async () => {
                  await copyToClipboard(props.pitchText ?? '')
                  setSheetOpen(false)
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy pitch draft
              </Button>
            </div>
          </div>

          <div className="rounded border border-cyan-500/10 bg-background/30 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
            <div className="mt-2 text-xs text-muted-foreground">
              This is a mobile triage view. It prioritizes a fast skim of signals and readiness, and links you into deeper surfaces when needed.
            </div>
          </div>
        </div>
      </MobileActionSheet>
    </div>
  )
}

