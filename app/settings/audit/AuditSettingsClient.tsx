'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'

type AuditLogRow = {
  id: string
  action: string
  target_type: string
  target_id: string | null
  meta: Record<string, unknown>
  created_at: string
  actor: { userId: string; email: string | null; displayName: string | null }
}

export function AuditSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<AuditLogRow[]>([])

  const queryString = useMemo(() => {
    const sp = new URLSearchParams()
    if (action.trim()) sp.set('action', action.trim())
    if (actor.trim()) sp.set('actor', actor.trim())
    if (from.trim()) sp.set('from', from.trim())
    if (to.trim()) sp.set('to', to.trim())
    const s = sp.toString()
    return s ? `?${s}` : ''
  }, [action, actor, from, to])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/team/audit${queryString}`, { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setRows([])
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: { logs?: AuditLogRow[] } }
      setRows(json.data?.logs ?? [])
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="audit-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin visibility across workspace activity.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
            <Input placeholder="action" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-filter-action" />
            <Input placeholder="actor user id" value={actor} onChange={(e) => setActor(e.target.value)} data-testid="audit-filter-actor" />
            <Input placeholder="from (ISO)" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="audit-filter-from" />
            <Input placeholder="to (ISO)" value={to} onChange={(e) => setTo(e.target.value)} data-testid="audit-filter-to" />
            <div className="md:col-span-4">
              <Button onClick={() => void load()} className="neon-border hover:glow-effect" data-testid="audit-apply">
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : rows.length === 0 ? (
              <div>No events found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Actor</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Target</th>
                      <th className="py-2 pr-2">Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-cyan-500/10">
                        <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-4">{r.actor.displayName ?? r.actor.email ?? r.actor.userId}</td>
                        <td className="py-2 pr-4 text-foreground">{r.action}</td>
                        <td className="py-2 pr-4">
                          {r.target_type}
                          {r.target_id ? ` · ${r.target_id}` : ''}
                        </td>
                        <td className="py-2 pr-2">
                          <span className="text-xs">{Object.keys(r.meta ?? {}).slice(0, 3).join(', ') || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

