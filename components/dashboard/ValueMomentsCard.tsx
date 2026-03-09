'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActivationV2 } from '@/components/dashboard/useActivationV2'

export function ValueMomentsCard() {
  const { model } = useActivationV2()
  if (!model) return null

  const a = model.activation
  const u = model.usage
  const isStarter = model.capabilities.tier === 'starter'

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Today’s state</CardTitle>
          {isStarter ? <Badge variant="outline">Starter (preview)</Badge> : <Badge variant="outline">Paid</Badge>}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Tracked accounts</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{a.counts.targets}</div>
        </div>
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Previews generated</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{a.counts.pitches + a.counts.reports}</div>
        </div>
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saved briefs</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{a.counts.briefs}</div>
        </div>
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Usage remaining</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{isStarter ? u.remaining : '∞'}</div>
          {isStarter ? (
            <div className="mt-1 text-xs text-muted-foreground">Free plan: {u.limit} preview generations total.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

