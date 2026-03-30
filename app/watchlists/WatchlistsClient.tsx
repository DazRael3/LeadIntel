'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePlan } from '@/components/PlanProvider'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Watchlist = {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  createdAt: string
}

type Item = {
  id: string
  leadId: string
  companyName: string
  companyDomain: string | null
  companyUrl: string | null
  note: string | null
  reminderAt: string | null
  reminderStatus: 'none' | 'scheduled' | 'shown' | 'dismissed' | 'completed'
  createdAt: string
}

type ListEnvelope =
  | {
      ok: true
      data: {
        watchlists: Watchlist[]
        items: Item[]
        workspace: { id: string; name: string }
        capabilities: { canUse: boolean; reason: string | null }
      }
    }
  | { ok: false; error?: { message?: string } }

type UpdateItemEnvelope = { ok: true; data: { ok: true } } | { ok: false; error?: { message?: string } }

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return '—'
  }
}

export function WatchlistsClient() {
  const { capabilities, tier } = usePlan()
  const { toast } = useToast()
  const allowed = capabilities.multi_watchlists === true

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ListEnvelope | null>(null)
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [reminderDraft, setReminderDraft] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const qs = activeWatchlistId ? `?watchlistId=${encodeURIComponent(activeWatchlistId)}` : ''
      const res = await fetch(`/api/lead-watchlists${qs}`, { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as ListEnvelope | null
      setData(json)
      if (json && json.ok === true) {
        if (!activeWatchlistId && json.data.watchlists[0]?.id) {
          setActiveWatchlistId(json.data.watchlists[0].id)
        }
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [activeWatchlistId])

  useEffect(() => {
    if (!allowed) return
    void refresh()
  }, [allowed, refresh])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const canUse = model?.capabilities.canUse ?? false
  const items = useMemo(() => model?.items ?? [], [model])

  useEffect(() => {
    // Prime drafts.
    const nextNotes: Record<string, string> = {}
    const nextReminders: Record<string, string> = {}
    for (const it of items) {
      nextNotes[it.id] = (it.note ?? '').toString()
      nextReminders[it.id] = it.reminderAt ? new Date(it.reminderAt).toISOString().slice(0, 16) : ''
    }
    setNoteDraft(nextNotes)
    setReminderDraft(nextReminders)
  }, [items])

  const showLocked = !allowed || !canUse

  async function saveItem(itemId: string) {
    if (!canUse) return
    const note = (noteDraft[itemId] ?? '').trim()
    const reminderLocal = (reminderDraft[itemId] ?? '').trim()
    const reminderAt = reminderLocal ? new Date(reminderLocal).toISOString() : null

    setSavingItemId(itemId)
    try {
      const res = await fetch('/api/lead-watchlists/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          note: note.length > 0 ? note : null,
          reminderAt,
          reminderStatus: reminderAt ? 'scheduled' : 'none',
        }),
      })
      const json = (await res.json().catch(() => null)) as UpdateItemEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        track('watchlists_item_update_failed', { tier })
        return
      }
      track('watchlists_item_updated', { tier })
      toast({ title: 'Saved.' })
      await refresh()
    } finally {
      setSavingItemId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="watchlists-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Watchlists</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Multi-watchlists with notes and reminders (Closer).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tier === 'starter' ? 'Starter' : tier === 'closer' ? 'Closer' : tier === 'closer_plus' ? 'Closer+' : 'Team'}</Badge>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {showLocked ? (
          <Card className="border-purple-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upgrade required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                Watchlists v2 (multi-list + reminders) unlock on the Closer plan.
              </div>
              <Button asChild size="sm" className="neon-border hover:glow-effect">
                <Link href="/pricing?target=closer">View Closer</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-cyan-500/20 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Lists</CardTitle>
                  <Badge variant="outline">{model?.workspace.name ?? 'Workspace'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(model?.watchlists ?? []).map((w) => (
                  <Button
                    key={w.id}
                    size="sm"
                    variant={activeWatchlistId === w.id ? 'default' : 'outline'}
                    onClick={() => {
                      setActiveWatchlistId(w.id)
                      track('watchlists_list_selected', { tier })
                    }}
                  >
                    {w.name}
                    {w.isDefault ? <span className="ml-2 text-[10px] opacity-70">(default)</span> : null}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-cyan-500/20 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Items</CardTitle>
                  <Badge variant="outline">{items.length} tracked</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No items yet. Star an account from the Lead Library to add it to your default watchlist.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((it) => (
                      <div key={it.id} className="rounded-lg border border-cyan-500/10 bg-background/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">{it.companyName}</div>
                            <div className="text-xs text-muted-foreground">
                              {(it.companyDomain ?? '—')}{it.companyUrl ? ` · ${it.companyUrl}` : ''}
                            </div>
                          </div>
                          <Badge variant="outline">{it.reminderStatus}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-foreground">Note</div>
                            <Textarea
                              value={noteDraft[it.id] ?? ''}
                              onChange={(e) => setNoteDraft((prev) => ({ ...prev, [it.id]: e.target.value }))}
                              placeholder="Why this account? What should happen next?"
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-foreground">Reminder</div>
                            <Input
                              type="datetime-local"
                              value={reminderDraft[it.id] ?? ''}
                              onChange={(e) => setReminderDraft((prev) => ({ ...prev, [it.id]: e.target.value }))}
                            />
                            <div className="text-xs text-muted-foreground">
                              Next reminder: {fmtWhen(it.reminderAt)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                          <Button
                            size="sm"
                            className="neon-border hover:glow-effect"
                            onClick={() => void saveItem(it.id)}
                            disabled={savingItemId === it.id}
                          >
                            {savingItemId === it.id ? 'Saving…' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="text-xs text-muted-foreground">
          Market symbol watchlist lives in the Markets sidebar; this page is for account watchlists (leads) with notes/reminders.
        </div>
      </div>
    </div>
  )
}

