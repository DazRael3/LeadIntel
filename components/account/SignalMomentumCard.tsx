'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SignalMomentum } from '@/lib/domain/explainability'
import { formatSignalType, formatRelativeDate } from '@/lib/domain/explainability'

function momentumVariant(label: SignalMomentum['label']): 'default' | 'outline' | 'destructive' {
  if (label === 'rising') return 'default'
  if (label === 'cooling') return 'destructive'
  return 'outline'
}

function momentumLabel(label: SignalMomentum['label']): string {
  if (label === 'rising') return 'Rising'
  if (label === 'cooling') return 'Cooling'
  return 'Steady'
}

export function SignalMomentumCard(props: { momentum: SignalMomentum | null; currentScore?: number | null }) {
  const m = props.momentum
  const currentScore = typeof props.currentScore === 'number' ? props.currentScore : m?.currentScore ?? null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Signal momentum</CardTitle>
          {m ? (
            <Badge variant={momentumVariant(m.label)}>
              {momentumLabel(m.label)} ({m.delta >= 0 ? '+' : ''}
              {m.delta})
            </Badge>
          ) : (
            <Badge variant="outline">—</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {!m ? (
          <div className="text-xs text-muted-foreground">Momentum isn’t available yet.</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Score {currentScore ?? m.currentScore}/100</Badge>
              <Badge variant="outline">
                Prior {m.priorScore}/100
              </Badge>
              <Badge variant="outline">Window {m.window}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">High-signal events</div>
                <div className="mt-1 text-lg font-semibold text-foreground">{m.highSignalEvents}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Most recent</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {m.mostRecentSignalAt ? formatRelativeDate(m.mostRecentSignalAt) : '—'}
                </div>
              </div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Top signal types</div>
              {m.topSignalTypes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.topSignalTypes.map((t) => (
                    <Badge key={t.type} variant="outline">
                      {formatSignalType(t.type)} · {t.count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">No signals in this window.</div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

