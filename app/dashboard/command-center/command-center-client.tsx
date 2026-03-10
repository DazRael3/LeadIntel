'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import type { CommandCenterSummary, CommandLaneItem } from '@/lib/services/command-center'
import { CommandLane } from '@/components/command/CommandLane'
import { WhyThisNeedsAttentionDrawer } from '@/components/command/WhyThisNeedsAttentionDrawer'

type Envelope =
  | { ok: true; data: { workspace: { id: string; name: string }; role: string; summary: CommandCenterSummary } }
  | { ok: false; error?: { message?: string } }

export function CommandCenterClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [role, setRole] = useState('viewer')
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null)
  const [openItem, setOpenItem] = useState<CommandLaneItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/command-center?limit=140', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Command Center unavailable', description: json && 'error' in json ? json.error?.message : 'Please try again.' })
        setSummary(null)
        return
      }
      setWorkspaceName(json.data.workspace.name)
      setRole(json.data.role)
      setSummary(json.data.summary)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const lanes = useMemo(() => {
    const l = summary?.lanes
    if (!l) return null
    return [
      { key: 'act_now' as const, title: 'Act now', items: l.act_now },
      { key: 'review_needed' as const, title: 'Review needed', items: l.review_needed },
      { key: 'blocked' as const, title: 'Blocked', items: l.blocked },
      { key: 'waiting' as const, title: 'Waiting', items: l.waiting },
      { key: 'stale' as const, title: 'Monitor / stale', items: l.stale },
    ]
  }, [summary])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="command-center-page">
      <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Command Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">Daily operating console (not real-time). Built from observed workflow state.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workspaceName}</Badge>
            <Badge variant="outline">role {role}</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
          </Card>
        ) : !lanes ? (
          <Card className="border-cyan-500/20 bg-card/50">
            <CardContent className="py-10 text-center text-muted-foreground">No command center summary available.</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <CommandLane lane="act_now" title="Act now" items={lanes[0].items} onOpenItem={(i) => setOpenItem(i)} />
              <CommandLane lane="review_needed" title="Review needed" items={lanes[1].items} onOpenItem={(i) => setOpenItem(i)} />
              <CommandLane lane="blocked" title="Blocked" items={lanes[2].items} onOpenItem={(i) => setOpenItem(i)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CommandLane lane="waiting" title="Waiting" items={lanes[3].items} onOpenItem={(i) => setOpenItem(i)} />
              <CommandLane lane="stale" title="Monitor / stale" items={lanes[4].items} onOpenItem={(i) => setOpenItem(i)} />
            </div>
            <div className="text-xs text-muted-foreground">{summary?.limitationsNote}</div>
          </>
        )}
      </div>

      <WhyThisNeedsAttentionDrawer open={Boolean(openItem)} item={openItem} onClose={() => setOpenItem(null)} />
    </div>
  )
}

