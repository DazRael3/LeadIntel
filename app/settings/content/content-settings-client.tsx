'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

type ContentRow = {
  id: string
  status: string
  angle: string
  body: string
  cta: string | null
  created_at: string
  company_name: string
  signal_title: string
  signal_url: string
  overall_score: number
}

type QueueEnvelope =
  | { ok: true; data: { workspaceId: string | null; role: string | null; items: ContentRow[]; reason?: string; configured?: boolean } }
  | { ok: false; error?: { message?: string; code?: string }; details?: unknown }

export function ContentSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ContentRow[]>([])
  const [queueMeta, setQueueMeta] = useState<{ workspaceId: string | null; role: string | null; reason?: string; configured?: boolean } | null>(null)
  const [filter, setFilter] = useState<'draft' | 'all'>('draft')
  const [saving, setSaving] = useState<string | null>(null)

  const visible = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.status === 'draft')
  }, [filter, items])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/prospect-watch/queue?kind=content', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as QueueEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({
          variant: 'destructive',
          title: 'Could not load content drafts',
          description: json && json.ok === false ? json.error?.message ?? 'Please try again.' : 'Please try again.',
        })
        setItems([])
        setQueueMeta(null)
        return
      }
      setItems(json.data.items ?? [])
      setQueueMeta({ workspaceId: json.data.workspaceId ?? null, role: json.data.role ?? null, reason: json.data.reason, configured: json.data.configured })
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
      setItems([])
      setQueueMeta(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setStatus = useCallback(
    async (id: string, status: 'approved' | 'rejected' | 'archived' | 'exported') => {
      setSaving(id)
      try {
        const res = await fetch('/api/prospect-watch/content', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Update failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        await refresh()
      } finally {
        setSaving(null)
      }
    },
    [refresh, toast]
  )

  const save = useCallback(
    async (id: string, patch: { angle?: string; body?: string; cta?: string | null }) => {
      setSaving(id)
      try {
        const res = await fetch('/api/prospect-watch/content', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        await refresh()
      } finally {
        setSaving(null)
      }
    },
    [refresh, toast]
  )

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="content-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Content</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review-first LinkedIn post drafts. Copy/export is the default workflow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={filter === 'draft' ? 'default' : 'outline'} onClick={() => setFilter('draft')}>
              Drafts
            </Button>
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
              All
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Queue</CardTitle>
              <Badge variant="outline">{visible.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
            {!loading && visible.length === 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">No content drafts yet.</div>
                <div className="rounded border border-cyan-500/10 bg-background/30 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground">Diagnostics</div>
                  <div>Workspace: {queueMeta?.workspaceId ? 'resolved' : queueMeta?.reason === 'workspace_missing' ? 'missing' : 'unknown'}</div>
                  <div>Configured feeds: {queueMeta?.configured === false ? 'no / disabled' : queueMeta?.configured === true ? 'yes' : 'unknown'}</div>
                </div>
              </div>
            ) : null}

            {visible.map((c) => (
              <div key={c.id} className="rounded border border-cyan-500/10 bg-background/40 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold">{c.company_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Basis:{' '}
                      <a className="text-cyan-300 hover:underline" href={c.signal_url} target="_blank" rel="noreferrer">
                        {c.signal_title}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-cyan-500/20">
                      {c.overall_score}/100
                    </Badge>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                </div>

                <Input
                  value={c.angle}
                  onChange={(e) => {
                    const v = e.target.value
                    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, angle: v } : x)))
                  }}
                  placeholder="Angle/title"
                />
                <Textarea
                  value={c.body}
                  onChange={(e) => {
                    const v = e.target.value
                    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, body: v } : x)))
                  }}
                  className="min-h-[140px]"
                />
                <Input
                  value={c.cta ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, cta: v.length ? v : null } : x)))
                  }}
                  placeholder="Optional CTA"
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving === c.id}
                    onClick={() => {
                      void navigator.clipboard.writeText([c.angle, '', c.body, c.cta ? `\n${c.cta}` : ''].join('\n').trim())
                      toast({ title: 'Copied post' })
                    }}
                  >
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === c.id} onClick={() => void save(c.id, { angle: c.angle, body: c.body, cta: c.cta })}>
                    Save
                  </Button>
                  <Button size="sm" className="neon-border hover:glow-effect" disabled={saving === c.id} onClick={() => void setStatus(c.id, 'approved')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === c.id} onClick={() => void setStatus(c.id, 'exported')}>
                    Mark exported
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === c.id} onClick={() => void setStatus(c.id, 'rejected')}>
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === c.id} onClick={() => void setStatus(c.id, 'archived')}>
                    Archive
                  </Button>
                  <Link className="text-xs text-cyan-300 hover:underline ml-auto self-center" href="/settings/prospects">
                    Review prospects →
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

