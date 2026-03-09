'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type ProgramRow = { id: string; lead_id: string | null; account_domain: string | null; account_name: string | null; program_state: string; updated_at: string }
type RecentAccount = { leadId: string | null; companyName: string | null; companyDomain: string | null; status: string; actionType: string; assignedTo: string | null; createdAt: string }

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; programs: ProgramRow[]; recentAccounts: RecentAccount[] } }
  | { ok: false; error?: { message?: string } }

function displayAccount(a: { account_name?: string | null; account_domain?: string | null; lead_id?: string | null }): string {
  const parts = [(a.account_name ?? '').trim(), (a.account_domain ?? '').trim()].filter(Boolean)
  if (parts.length > 0) return parts.join(' · ')
  const id = a.lead_id
  return id ? `Account ${id.slice(0, 8)}…` : '—'
}

export function PortfolioDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [programs, setPrograms] = useState<ProgramRow[]>([])
  const [recent, setRecent] = useState<RecentAccount[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team/portfolio?limit=100', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Portfolio unavailable', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        return
      }
      setWorkspaceName(json.data.workspace.name)
      setPrograms(json.data.programs ?? [])
      setRecent(json.data.recentAccounts ?? [])
      track('portfolio_board_viewed', { surface: 'dashboard_portfolio' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const byState = new Map<string, ProgramRow[]>()
    for (const p of programs) {
      const k = p.program_state || 'standard'
      byState.set(k, [...(byState.get(k) ?? []), p])
    }
    return byState
  }, [programs])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="portfolio-dashboard-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Portfolio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Coverage and programs at team scale (bounded, explainable).</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspaceName}</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account programs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : programs.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No program flags yet. Mark accounts as Strategic / Expansion watch from an account’s Coverage panel.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from(grouped.entries()).map(([state, rows]) => (
                  <div key={state} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-foreground font-medium">{state}</div>
                      <Badge variant="outline">{rows.length}</Badge>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {rows.slice(0, 6).map((r) => (
                        <li key={r.id}>{displayAccount(r)}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent workflow accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : recent.length === 0 ? (
              <div className="text-xs text-muted-foreground">No workspace workflow activity yet.</div>
            ) : (
              <div className="overflow-hidden rounded border border-cyan-500/10">
                <table className="w-full text-xs">
                  <thead className="bg-background/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, 25).map((r, idx) => (
                      <tr key={`${r.leadId ?? 'none'}:${idx}`} className="border-t border-cyan-500/10">
                        <td className="px-3 py-2 text-foreground">{(r.companyName ?? r.companyDomain ?? r.leadId ?? '—').toString()}</td>
                        <td className="px-3 py-2">{r.actionType}</td>
                        <td className="px-3 py-2">{r.status}</td>
                        <td className="px-3 py-2">{r.assignedTo ? r.assignedTo.slice(0, 8) + '…' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              Names/domains are sourced from workflow payload metadata when available. No CRM sync is implied.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

