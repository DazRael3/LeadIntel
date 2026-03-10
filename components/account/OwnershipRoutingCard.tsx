'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Summary = {
  territory: { matched: boolean; territoryKey: string | null; note: string }
  assignedUserIds: string[]
  programState: string
  nextAction: string
  limitationsNote: string | null
}

type Envelope = { ok: true; data: { summary: Summary } } | { ok: false; error?: { message?: string } }

export function OwnershipRoutingCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/coverage?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setSummary(null)
        return
      }
      setSummary(json.data.summary)
      track('ownership_routing_viewed', { surface: 'account', accountId: props.accountId })
    } catch {
      setSummary(null)
      toast({ variant: 'destructive', title: 'Routing unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const routingText = useMemo(() => {
    if (!summary) return null
    if (summary.assignedUserIds.length > 1) return 'Ownership overlap detected — resolve to a single owner.'
    if (summary.assignedUserIds.length === 1) return 'Owner assigned via workspace workflow.'
    if (summary.territory.matched) return `No owner assigned. Territory suggests routing to "${summary.territory.territoryKey}".`
    return 'No owner assigned and no territory match.'
  }, [summary])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Ownership routing</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? (
          <div>Loading…</div>
        ) : !summary || !routingText ? (
          <div className="text-xs text-muted-foreground">Routing is not available yet.</div>
        ) : (
          <>
            <div className="text-foreground font-medium">{routingText}</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">program: {summary.programState}</Badge>
              <Badge variant="outline">
                territory: {summary.territory.matched ? summary.territory.territoryKey ?? 'matched' : 'none'}
              </Badge>
              <Badge variant="outline">assigned: {summary.assignedUserIds.length}</Badge>
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Next:</span> {summary.nextAction}
            </div>
            {summary.limitationsNote ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Limitations:</span> {summary.limitationsNote}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

