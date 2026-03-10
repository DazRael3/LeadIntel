'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { AuditFilterBar } from '@/components/settings/AuditFilterBar'
import { AuditEventDetail } from '@/components/settings/AuditEventDetail'
import { AuditEventTable, type AuditLogRow } from '@/components/settings/AuditEventTable'

export function AuditSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<AuditLogRow | null>(null)

  const queryString = useMemo(() => {
    const sp = new URLSearchParams()
    if (action.trim()) sp.set('action', action.trim())
    if (actor.trim()) sp.set('actor', actor.trim())
    if (from.trim()) sp.set('from', from.trim())
    if (to.trim()) sp.set('to', to.trim())
    sp.set('page', String(page))
    sp.set('pageSize', '50')
    const s = sp.toString()
    return s ? `?${s}` : ''
  }, [action, actor, from, to, page])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/team/audit${queryString}`, { method: 'GET', cache: 'no-store' })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        setRows([])
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: { logs?: AuditLogRow[]; hasMore?: boolean } }
      setRows(json.data?.logs ?? [])
      setHasMore(Boolean(json.data?.hasMore))
      setSelected(null)
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="audit-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin visibility across workspace activity.</p>
        </div>

        <AuditFilterBar
          action={action}
          actor={actor}
          from={from}
          to={to}
          onChange={(next) => {
            setAction(next.action)
            setActor(next.actor)
            setFrom(next.from)
            setTo(next.to)
          }}
          onApply={() => {
            setPage(0)
          }}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AuditEventTable loading={loading} rows={rows} onSelect={(r) => setSelected(r)} />
            <Card className="mt-4 border-cyan-500/20 bg-card/50">
              <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <div>Page {page + 1}</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (page <= 0) return
                      setPage((p) => Math.max(0, p - 1))
                    }}
                    disabled={page <= 0 || loading}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!hasMore) return
                      setPage((p) => p + 1)
                    }}
                    disabled={!hasMore || loading}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-1">
            <AuditEventDetail selected={selected} />
          </div>
        </div>
      </div>
    </div>
  )
}

