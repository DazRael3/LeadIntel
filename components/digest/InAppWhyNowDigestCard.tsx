'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlan } from '@/components/PlanProvider'
import { track } from '@/lib/analytics'

type Envelope =
  | { ok: true; data: { enabledByTier: boolean; items: Array<{ id: string; createdAt: string; readAt: string | null; body: string | null; meta: Record<string, unknown> }> } }
  | { ok: false; error?: { message?: string } }

function safeLeads(meta: Record<string, unknown>): Array<{ leadId: string; companyName: string; score: number }> {
  const leads = (meta.leads ?? null) as unknown
  if (!Array.isArray(leads)) return []
  return leads
    .map((l) => {
      if (!l || typeof l !== 'object') return null
      const row = l as Record<string, unknown>
      const leadId = typeof row.leadId === 'string' ? row.leadId : null
      const companyName = typeof row.companyName === 'string' ? row.companyName : null
      const score = typeof row.score === 'number' ? row.score : null
      if (!leadId || !companyName || score == null) return null
      return { leadId, companyName, score }
    })
    .filter((x): x is { leadId: string; companyName: string; score: number } => Boolean(x))
}

export function InAppWhyNowDigestCard() {
  const { tier, capabilities } = usePlan()
  const allowed = capabilities.why_now_digest_in_app === true

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<Envelope | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/digest/in-app', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    void refresh()
  }, [allowed, refresh])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const latest = model?.items?.[0] ?? null
  const latestMeta = latest ? (latest.meta ?? {}) : {}
  const topLeads = latest ? safeLeads(latestMeta).slice(0, 3) : []

  if (!allowed) return null

  async function forceRefresh() {
    setSaving(true)
    try {
      const res = await fetch('/api/digest/in-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      })
      if (!res.ok) {
        track('digest_in_app_refresh_failed', { tier })
        return
      }
      track('digest_in_app_refreshed', { tier })
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="in-app-digest-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Why-now digest</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">A tight shortlist of timely signals (in-app).</div>
          </div>
          <Badge variant="outline">Closer</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading && !model ? (
          <div>Loading digest…</div>
        ) : !model?.enabledByTier ? (
          <div>Digest is unavailable on your plan.</div>
        ) : !latest ? (
          <div className="space-y-2">
            <div>No digest yet. Generate one to start the habit loop.</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" className="neon-border hover:glow-effect" onClick={() => void forceRefresh()} disabled={saving}>
                {saving ? 'Generating…' : 'Generate digest'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Latest: {new Date(latest.createdAt).toLocaleString()}
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/30 p-3 text-sm text-foreground">
              {latest.body ?? 'Why-now digest ready.'}
            </div>
            {topLeads.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-foreground">Top accounts</div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {topLeads.map((l) => (
                    <li key={l.leadId} className="flex items-center justify-between gap-2">
                      <span className="truncate">{l.companyName}</span>
                      <span className="shrink-0">score {l.score}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/watchlists">Open watchlists</Link>
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" variant="outline" onClick={() => void forceRefresh()} disabled={saving}>
                {saving ? 'Refreshing…' : 'Refresh digest'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
                Refresh list
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

