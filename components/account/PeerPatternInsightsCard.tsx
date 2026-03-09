'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type PeerPatternResponse = {
  insight: {
    band: string
    summary: string
    whyThisBucket: string
    confidence: string
    limitationsNote: string | null
    eligibility: { eligible: boolean; privacyNote: string }
  }
}

function bandBadge(band: string): { text: string; variant: 'default' | 'secondary' | 'destructive' } {
  const b = band.toLowerCase()
  if (b === 'above_norm' || b === 'promising_pattern') return { text: 'Promising', variant: 'default' }
  if (b === 'within_norm') return { text: 'Typical', variant: 'secondary' }
  if (b === 'below_norm') return { text: 'Caution', variant: 'destructive' }
  return { text: 'Limited', variant: 'secondary' }
}

export function PeerPatternInsightsCard(props: { accountId: string; window: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PeerPatternResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/peer-patterns?window=${encodeURIComponent(props.window)}`, {
        method: 'GET',
      })
      const json = (await res.json()) as { success?: boolean; data?: PeerPatternResponse; error?: { message?: string } }
      if (!res.ok || !json.success || !json.data) throw new Error(json.error?.message ?? 'Failed to load peer patterns')
      setData(json.data)
    } catch (e) {
      setData(null)
      toast({ title: 'Peer patterns unavailable', description: e instanceof Error ? e.message : 'Failed to load peer patterns', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const insight = data?.insight ?? null
  const badge = bandBadge(insight?.band ?? '')

  useEffect(() => {
    if (!insight) return
    if (insight.eligibility && insight.eligibility.eligible === false) {
      track('privacy_guard_callout_viewed', { surface: 'account_peer_pattern', reason: 'suppressed' })
    }
  }, [insight])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Peer-pattern insight</CardTitle>
          <div className="text-xs text-muted-foreground">Privacy-safe, aggregated guidance when eligible.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={badge.variant}>{badge.text}</Badge>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
        {!loading && !insight ? <div className="text-sm text-muted-foreground">No peer-pattern insight available.</div> : null}
        {insight ? (
          <>
            <div className="text-sm text-foreground">{insight.summary}</div>
            <div className="text-xs text-muted-foreground">{insight.whyThisBucket}</div>
            <div className="text-xs text-muted-foreground">{insight.eligibility?.privacyNote ?? ''}</div>
            {insight.limitationsNote ? <div className="text-xs text-muted-foreground">{insight.limitationsNote}</div> : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

