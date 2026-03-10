'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { RecommendationBundle } from '@/lib/recommendations/types'
import { RecommendationBadge } from '@/components/recommendations/RecommendationBadge'
import { WhyRecommendedDrawer } from '@/components/recommendations/WhyRecommendedDrawer'
import { track } from '@/lib/analytics'

type Envelope =
  | { ok: true; data: { bundle: RecommendationBundle } }
  | { ok: false; error?: { message?: string } }

type AttributionEnvelope =
  | {
      ok: true
      data: {
        type: 'attribution_support_summary'
        label: string
        verification: { label: string; note: string }
        limitationsNote: string
      }
    }
  | { ok: false; error?: { message?: string } }

function rankBadge(score: number): { label: string; cls: string } {
  if (score >= 70) return { label: 'High priority', cls: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' }
  if (score >= 45) return { label: 'Review', cls: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' }
  return { label: 'Low', cls: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
}

export function RecommendationSummaryCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [bundle, setBundle] = useState<RecommendationBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [attrib, setAttrib] = useState<{ label: string; verification: { label: string; note: string } } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const [res, attribRes] = await Promise.all([
        fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/recommendations?${qs.toString()}`, { cache: 'no-store' }),
        fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/attribution-support`, { cache: 'no-store' }),
      ])

      const json = (await res.json().catch(() => null)) as Envelope | null
      const attribJson = (await attribRes.json().catch(() => null)) as AttributionEnvelope | null

      if (!res.ok || !json || json.ok !== true) {
        setBundle(null)
        setAttrib(null)
        return
      }
      setBundle(json.data.bundle)
      track('recommendation_viewed', { surface: 'account', accountId: props.accountId, version: json.data.bundle.recommendations[0]?.version })

      if (attribRes.ok && attribJson && attribJson.ok === true) {
        setAttrib({ label: attribJson.data.label, verification: attribJson.data.verification })
      } else {
        setAttrib(null)
      }
    } catch {
      setBundle(null)
      setAttrib(null)
      toast({ variant: 'destructive', title: 'Recommendations unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const header = useMemo(() => {
    if (!bundle) return null
    const rb = rankBadge(bundle.rank.priorityScore)
    return { rb }
  }, [bundle])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Recommendations</CardTitle>
          <div className="flex items-center gap-2">
            {bundle ? <RecommendationBadge confidence={bundle.summary.confidence} /> : null}
            {bundle && header ? (
              <Badge variant="outline" className={header.rb.cls}>
                {header.rb.label}
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
        ) : !bundle ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
            Recommendations are not available yet for this account.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground font-medium">{bundle.summary.whyNow}</span>
              {bundle.rank.delta ? (
                <Badge variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                  Δ {bundle.rank.delta.direction} ({bundle.rank.delta.magnitude})
                </Badge>
              ) : null}
            </div>

            {attrib ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground">Downstream support: {attrib.label.replaceAll('_', ' ')}</span>
                  <Badge variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                    {attrib.verification.label.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <div className="mt-1">{attrib.verification.note}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {bundle.recommendations.slice(0, 4).map((r) => (
                <div key={r.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-foreground font-medium">{r.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.reasonSummary}</div>
                </div>
              ))}
            </div>

            <WhyRecommendedDrawer bundle={bundle} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

