"use client"

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

type Citation = { url?: unknown; type?: unknown; source?: unknown; publishedAt?: unknown; title?: unknown }

function asCitations(value: unknown): Array<{ url: string; type: string; source?: string; publishedAt?: string; title?: string }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ url: string; type: string; source?: string; publishedAt?: string; title?: string }> = []
  for (const x of value) {
    if (!x || typeof x !== 'object') continue
    const c = x as Citation
    const url = typeof c.url === 'string' ? c.url.trim() : ''
    if (!url || !url.startsWith('http')) continue
    const type = typeof c.type === 'string' ? c.type.trim() : 'source'
    out.push({
      url,
      type,
      source: typeof c.source === 'string' ? c.source.trim() : undefined,
      publishedAt: typeof c.publishedAt === 'string' ? c.publishedAt.trim() : undefined,
      title: typeof c.title === 'string' ? c.title.trim() : undefined,
    })
    if (out.length >= 100) break
  }
  return out
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Not refreshed yet'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'Not refreshed yet'
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function SourcesFreshnessPanelClient(props: {
  companyName: string
  companyDomain: string | null
  inputUrl: string | null
  sourcesFetchedAt: string | null
  sourcesUsed: unknown
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const citations = useMemo(() => asCitations(props.sourcesUsed), [props.sourcesUsed])
  const byType = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of citations) m.set(c.type, (m.get(c.type) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [citations])

  async function onRefresh() {
    setIsRefreshing(true)
    try {
      // 1) Refresh sources
      const refreshRes = await fetch('/api/sources/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: props.companyName,
          company_domain: props.companyDomain,
          input_url: props.inputUrl,
          force: true,
        }),
      })
      const refreshJson = (await refreshRes.json()) as { ok: boolean; error?: { message?: string } }
      if (!refreshJson.ok) {
        toast({ variant: 'destructive', title: 'Refresh failed', description: refreshJson.error?.message ?? 'Please try again.' })
        return
      }

      // 2) Regenerate report (saved as a new report row)
      const genRes = await fetch('/api/competitive-report/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: props.companyName,
          company_domain: props.companyDomain,
          input_url: props.inputUrl,
          force_refresh: false,
        }),
      })
      const genJson = (await genRes.json()) as { ok: boolean; data?: { reportId?: string }; error?: { message?: string } }
      if (!genJson.ok || !genJson.data?.reportId) {
        toast({ variant: 'destructive', title: 'Report generation failed', description: genJson.error?.message ?? 'Please try again.' })
        return
      }

      toast({ variant: 'success', title: 'Sources refreshed', description: 'A new report was generated and saved.' })
      router.push(`/competitive-report?id=${encodeURIComponent(genJson.data.reportId)}`)
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const noSources = citations.length === 0

  return (
    <Card className="border-cyan-500/10 bg-background/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Sources & freshness</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Last refreshed: <span title={props.sourcesFetchedAt ?? undefined}>{formatRelative(props.sourcesFetchedAt)}</span>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : 'Refresh sources'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {noSources ? (
          <div className="rounded border border-cyan-500/10 bg-card/30 p-3 text-sm text-muted-foreground">
            Sources not available yet — refresh to fetch latest signals.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {byType.map(([type, count]) => (
              <Badge key={type} variant="outline">
                {type.replace(/_/g, ' ')}: {count}
              </Badge>
            ))}
          </div>
        )}

        {citations.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            This report only treats claims as factual when a citation URL is available. Anything else is labeled as a hypothesis with a verification checklist.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

