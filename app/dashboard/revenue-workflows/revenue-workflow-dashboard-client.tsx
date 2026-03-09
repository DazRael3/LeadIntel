'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type Health = {
  mappedAccounts: number
  verifiedAccountMappings: number
  opportunityMappings: number
  observations: number
  needsReviewMappings: number
  ambiguousMappings: number
  staleMappings: number
  note: string
}

type Review = { id: string; target_type: string; target_id: string; status: string; note: string | null; reviewed_at: string }

type Row = {
  accountId: string
  companyName: string | null
  companyDomain: string | null
  mappingVerificationStatus: string | null
  lastObservedAt: string | null
  lastObservedStage: string | null
  lastObservedStatus: string | null
}

type Envelope =
  | { ok: true; data: { workspaceId: string; health: Health; recentReviews: Review[]; accounts: Row[] } }
  | { ok: false; error?: { message?: string } }

export function RevenueWorkflowDashboardClient() {
  const [loading, setLoading] = useState(true)
  const [health, setHealth] = useState<Health | null>(null)
  const [accounts, setAccounts] = useState<Row[]>([])
  const [reviews, setReviews] = useState<Review[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/revenue/workflow-summary', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setHealth(null)
        setAccounts([])
        setReviews([])
        return
      }
      setHealth(json.data.health)
      setAccounts(json.data.accounts ?? [])
      setReviews(json.data.recentReviews ?? [])
      track('revenue_workflow_summary_viewed', { count: (json.data.accounts ?? []).length })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const withDownstream = useMemo(() => accounts.filter((a) => Boolean(a.lastObservedAt)).length, [accounts])
  const withVerifiedMapping = useMemo(() => accounts.filter((a) => a.mappingVerificationStatus === 'verified').length, [accounts])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="revenue-workflow-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Revenue workflows</h1>
            <p className="mt-1 text-sm text-muted-foreground">Verified downstream visibility and linkage coverage (bounded, non-causal).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{withVerifiedMapping} verified mappings</Badge>
            <Badge variant="outline">{withDownstream} with downstream observation</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Linkage health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && !health ? <div className="rounded border border-cyan-500/10 bg-background/40 p-3">Unavailable.</div> : null}
            {!loading && health ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">mapped {health.mappedAccounts}</Badge>
                  <Badge variant="outline">verified {health.verifiedAccountMappings}</Badge>
                  <Badge variant="outline">opps {health.opportunityMappings}</Badge>
                  <Badge variant="outline">observations {health.observations}</Badge>
                  {health.needsReviewMappings > 0 ? <Badge variant="outline">needs review {health.needsReviewMappings}</Badge> : null}
                  {health.ambiguousMappings > 0 ? <Badge variant="outline">ambiguous {health.ambiguousMappings}</Badge> : null}
                  {health.staleMappings > 0 ? <Badge variant="outline">stale {health.staleMappings}</Badge> : null}
                </div>
                <div className="text-xs text-muted-foreground">{health.note}</div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accounts (your workspace scope)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && accounts.length === 0 ? <div>No accounts found in this scope.</div> : null}
            {!loading && accounts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-cyan-500/10">
                      <th className="py-2 text-left">Account</th>
                      <th className="py-2 text-left">Mapping</th>
                      <th className="py-2 text-left">Downstream</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.slice(0, 25).map((a) => (
                      <tr key={a.accountId} className="border-b border-cyan-500/5">
                        <td className="py-2 pr-3">
                          <div className="text-foreground">{a.companyName ?? 'Unknown company'}</div>
                          <div className="text-muted-foreground">{a.companyDomain ?? a.accountId.slice(0, 8) + '…'}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{a.mappingVerificationStatus ?? 'unmapped'}</Badge>
                        </td>
                        <td className="py-2">
                          {a.lastObservedAt ? (
                            <div>
                              <div className="text-foreground">
                                {a.lastObservedStage ?? 'stage —'}
                                {a.lastObservedStatus ? ` · ${a.lastObservedStatus}` : ''}
                              </div>
                              <div className="text-muted-foreground">{new Date(a.lastObservedAt).toLocaleDateString()}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No observation</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent verification activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && reviews.length === 0 ? <div>No recent verification activity.</div> : null}
            {!loading && reviews.length > 0 ? (
              <div className="space-y-2">
                {reviews.slice(0, 10).map((r) => (
                  <div key={r.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {r.target_type} · {new Date(r.reviewed_at).toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs font-mono text-foreground break-all">{r.target_id}</div>
                        {r.note ? <div className="mt-1 text-xs text-muted-foreground">{r.note}</div> : null}
                      </div>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

