'use client'

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BuyingGroupRecommendation } from '@/lib/domain/people'
import { track } from '@/lib/analytics'

function confidenceVariant(c: BuyingGroupRecommendation['confidence']): 'default' | 'outline' | 'destructive' {
  if (c === 'strong') return 'default'
  if (c === 'usable') return 'outline'
  return 'destructive'
}

export function BuyingGroupCard(props: { accountId: string; buyingGroup: BuyingGroupRecommendation }) {
  useEffect(() => {
    track('buying_group_viewed', { accountId: props.accountId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount in modal context
  }, [])

  const bg = props.buyingGroup

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Buying group (recommended)</CardTitle>
          <Badge variant={confidenceVariant(bg.confidence)}>{bg.confidence}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Champion</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{bg.champion ?? '—'}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Economic buyer</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{bg.economicBuyer ?? '—'}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Evaluator</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{bg.evaluator ?? '—'}</div>
          </div>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Priority order</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {bg.priorityOrder.map((p) => (
              <Badge key={p} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Rationale</div>
          <div className="mt-2 space-y-3">
            {bg.priorityOrder.slice(0, 4).map((p) => (
              <div key={p} className="text-xs text-muted-foreground">
                <div className="text-foreground font-medium">{p}</div>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {(bg.rationale[p] ?? ['Recommended based on available signals.']).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {bg.limitations.length > 0 ? <div className="text-xs text-muted-foreground">{bg.limitations.join(' ')}</div> : null}
      </CardContent>
    </Card>
  )
}

