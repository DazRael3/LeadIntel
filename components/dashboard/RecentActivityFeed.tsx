'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { formatRelativeDate } from '@/lib/domain/explainability'

type ActivityEnvelope =
  | { ok: true; data: { items: Array<{ id: string; kind: string; createdAt: string; label: string; href: string | null }> } }
  | { ok: false; error?: { message?: string } }

export function RecentActivityFeed() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Array<{ id: string; kind: string; createdAt: string; label: string; href: string | null }>>([])

  useEffect(() => {
    track('recent_activity_feed_viewed', { location: 'dashboard_command' })
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/activity/recent', { cache: 'no-store', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as ActivityEnvelope | null
        if (cancelled) return
        if (!res.ok || !json || json.ok !== true) {
          setItems([])
          return
        }
        setItems(Array.isArray(json.data.items) ? json.data.items : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const emptyLabel = useMemo(() => {
    if (loading) return 'Loading…'
    return 'No recent activity yet.'
  }, [loading])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Badge variant="outline">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">{emptyLabel}</div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 10).map((it) => (
              <div key={`${it.kind}:${it.id}`} className="flex items-start justify-between gap-3 rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-foreground font-medium truncate">{it.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{formatRelativeDate(it.createdAt)}</div>
                </div>
                {it.href ? (
                  <Link className="text-xs text-cyan-400 hover:underline shrink-0" href={it.href}>
                    Open
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

