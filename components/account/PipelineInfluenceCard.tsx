'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ObservedVsInferredCallout } from '@/components/revenue/ObservedVsInferredCallout'

type Influence = {
  influence: 'unknown' | 'early_influence' | 'building' | 'high_attention' | 'confirmed_progression'
  reasonSummary: string
  confidence: 'limited' | 'usable' | 'strong'
  limitationsNote: string | null
  whatIsMissing: string[]
}

type Envelope =
  | { ok: true; data: { influence: Influence } }
  | { ok: false; error?: { message?: string } }

function labelText(x: Influence['influence']): string {
  if (x === 'early_influence') return 'Early influence'
  if (x === 'building') return 'Building'
  if (x === 'high_attention') return 'High attention'
  if (x === 'confirmed_progression') return 'Confirmed progression'
  return 'Unknown'
}

export function PipelineInfluenceCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [inf, setInf] = useState<Influence | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/pipeline-influence?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setInf(null)
        return
      }
      setInf(json.data.influence)
    } catch {
      setInf(null)
      toast({ variant: 'destructive', title: 'Influence unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const badge = useMemo(() => {
    if (!inf) return null
    const cls =
      inf.influence === 'confirmed_progression'
        ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
        : inf.influence === 'high_attention'
          ? 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
          : inf.influence === 'building'
            ? 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
            : 'border-muted-foreground/20 text-muted-foreground bg-muted/20'
    return { cls, label: labelText(inf.influence) }
  }, [inf])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Pipeline influence</CardTitle>
          <div className="flex items-center gap-2">
            {badge ? (
              <Badge variant="outline" className={badge.cls}>
                {badge.label}
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? (
          <div>Loading…</div>
        ) : !inf ? (
          <div className="text-xs text-muted-foreground">Influence is not available yet.</div>
        ) : (
          <>
            <div className="text-foreground font-medium">{inf.reasonSummary}</div>
            <ObservedVsInferredCallout />
            {inf.whatIsMissing.length > 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                <div className="text-foreground font-medium">What’s missing</div>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {inf.whatIsMissing.slice(0, 4).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {inf.limitationsNote ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Caution:</span> {inf.limitationsNote}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

