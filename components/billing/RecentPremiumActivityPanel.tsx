'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type ActivityItem = {
  assetType: 'pitch' | 'report'
  objectId: string
  title: string
  companyName: string | null
  companyDomain: string | null
  createdAt: string
  status: 'preview_locked' | 'full_access' | 'saved'
  statusLabel: string
  sourceSurface: string | null
  primaryAction: { label: string; href: string }
  upgradeAction?: { label: string; href: string }
}

type ApiEnvelope =
  | { ok: true; data: { items: ActivityItem[] } }
  | { ok: false; error?: { message?: string } }

function statusVariant(label: string): 'secondary' | 'outline' | 'destructive' {
  const v = label.toLowerCase()
  if (v.includes('preview') || v.includes('locked')) return 'secondary'
  if (v.includes('saved')) return 'outline'
  if (v.includes('full')) return 'outline'
  return 'secondary'
}

function fmtTime(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toLocaleString()
}

export function RecentPremiumActivityPanel(props: { surface: string }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  const viewPayload = useMemo(() => ({ surface: props.surface }), [props.surface])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('recent_premium_activity_viewed', viewPayload)
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [viewPayload])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setError(null)
      try {
        const res = await fetch('/api/usage/premium-activity', { method: 'GET', cache: 'no-store', credentials: 'include' })
        const json = (await res.json()) as ApiEnvelope
        if (!res.ok || !json || json.ok !== true) {
          if (!cancelled) setItems([])
          return
        }
        if (cancelled) return
        setItems(json.data.items ?? [])
      } catch {
        if (!cancelled) setError('Failed to load activity.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent premium activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <div className="text-sm text-muted-foreground">{error}</div> : null}
        {items && items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recent premium activity found.</div>
        ) : null}
        {items && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((i) => (
              <div key={`${i.assetType}:${i.objectId}`} className="rounded border border-cyan-500/10 bg-background/30 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {i.assetType === 'pitch' ? 'Pitch preview' : 'Report'} · {i.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtTime(i.createdAt)}</div>
                  </div>
                  <Badge variant={statusVariant(i.statusLabel)}>{i.statusLabel}</Badge>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {i.sourceSurface ? <span className="mr-2">Source: {i.sourceSurface}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={i.primaryAction.href}>{i.primaryAction.label}</Link>
                    </Button>
                    {i.upgradeAction ? (
                      <Button
                        asChild
                        size="sm"
                        className="neon-border hover:glow-effect"
                        onClick={() => track('upgrade_clicked_from_locked_preview', { surface: props.surface, assetType: i.assetType })}
                      >
                        <Link href={i.upgradeAction.href}>{i.upgradeAction.label}</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

