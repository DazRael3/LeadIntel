'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Summary = {
  state: string
  confidence: 'limited' | 'usable' | 'strong'
  programState: string
  assignedUserIds: string[]
  territory: { matched: boolean; territoryKey: string | null; note: string }
  reasonSummary: string
  limitationsNote: string | null
  nextAction: string
}

type Envelope = { ok: true; data: { summary: Summary } } | { ok: false; error?: { message?: string } }

function badgeForState(state: string): { label: string; cls: string } {
  if (state === 'owned_and_active') return { label: 'Owned & active', cls: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' }
  if (state === 'owned_but_stale') return { label: 'Owned but stale', cls: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
  if (state === 'unowned') return { label: 'Unowned', cls: 'border-red-500/30 text-red-200 bg-red-500/10' }
  if (state === 'blocked') return { label: 'Blocked', cls: 'border-red-500/30 text-red-200 bg-red-500/10' }
  if (state === 'overlapping_ownership') return { label: 'Overlapping owners', cls: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
  if (state === 'expansion_watch') return { label: 'Expansion watch', cls: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' }
  if (state === 'strategic_focus') return { label: 'Strategic focus', cls: 'border-purple-500/30 text-purple-200 bg-purple-500/10' }
  return { label: state, cls: 'border-muted-foreground/20 text-muted-foreground bg-muted/20' }
}

export function CoverageSummaryCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
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
      track('coverage_summary_viewed', { surface: 'account', accountId: props.accountId })
    } catch {
      setSummary(null)
      toast({ variant: 'destructive', title: 'Coverage unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const badge = useMemo(() => (summary ? badgeForState(summary.state) : null), [summary])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Coverage</CardTitle>
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
        ) : !summary ? (
          <div className="text-xs text-muted-foreground">Coverage summary not available yet.</div>
        ) : (
          <>
            <div className="text-foreground font-medium">{summary.reasonSummary}</div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
              <div>
                <span className="text-foreground font-medium">Program:</span> {summary.programState}
              </div>
              <div className="mt-1">
                <span className="text-foreground font-medium">Territory:</span>{' '}
                {summary.territory.matched ? summary.territory.territoryKey ?? 'Matched' : 'No match'}
              </div>
              <div className="mt-1">
                <span className="text-foreground font-medium">Assigned:</span> {summary.assignedUserIds.length > 0 ? `${summary.assignedUserIds.length} owner(s)` : 'None'}
              </div>
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

