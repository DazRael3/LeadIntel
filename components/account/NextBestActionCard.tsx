'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { RecommendationBadge } from '@/components/recommendations/RecommendationBadge'

type Action = {
  id: string
  label: string
  whyNow: string
  whyNot: string
  confidence: 'limited' | 'usable' | 'strong'
  limitationsNote: string | null
  dependsOn: Array<{ kind: 'plan' | 'setup' | 'policy'; note: string }>
}

type Envelope = { ok: true; data: { action: Action } } | { ok: false; error?: { message?: string } }

export function NextBestActionCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<Action | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/next-action?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setAction(null)
        return
      }
      setAction(json.data.action)
    } catch {
      setAction(null)
      toast({ variant: 'destructive', title: 'Next action unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Next best action</CardTitle>
          <div className="flex items-center gap-2">
            {action ? <RecommendationBadge confidence={action.confidence} /> : null}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? (
          <div>Loading…</div>
        ) : !action ? (
          <div className="text-xs text-muted-foreground">No action suggestion yet.</div>
        ) : (
          <>
            <div className="text-foreground font-medium">{action.label}</div>
            <div className="text-xs text-muted-foreground">{action.whyNow}</div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Why not something else:</span> {action.whyNot}
            </div>
            {action.limitationsNote ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Limitations:</span> {action.limitationsNote}
              </div>
            ) : null}
            {action.dependsOn.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {action.dependsOn.map((d, idx) => (
                  <Badge key={`${d.kind}:${idx}`} variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                    {d.kind}: {d.note}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

