'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { formatRelativeDate } from '@/lib/domain/explainability'

type BriefRow = {
  id: string
  created_at: string
  title: string
  report_markdown: string
  sources_fetched_at: string | null
}

type GetEnvelope =
  | { ok: true; data: { brief: BriefRow | null; window: string | null } }
  | { ok: false; error?: { message?: string } }

type PostEnvelope =
  | { ok: true; data: { reportId: string; brief_markdown: string } }
  | { ok: false; error?: { code?: string; message?: string } }

export function AccountBriefCard(props: {
  accountId: string
  companyName: string
  companyDomain: string | null
  inputUrl: string | null
  signalWindow: '7d' | '30d' | '90d' | 'all'
  isPro: boolean
  refreshKey?: number
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [brief, setBrief] = useState<BriefRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [refreshSources, setRefreshSources] = useState(false)

  const canGenerate = props.isPro

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/brief`, { method: 'GET', cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as GetEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        setBrief(null)
        setError('Unable to load account brief.')
        return
      }
      setBrief(json.data.brief)
    } catch {
      setBrief(null)
      setError('Unable to load account brief.')
    } finally {
      setLoading(false)
    }
  }, [props.accountId])

  useEffect(() => {
    void load()
  }, [load, props.refreshKey])

  const onGenerate = useCallback(async () => {
    if (!canGenerate) {
      toast({ variant: 'destructive', title: 'Upgrade required', description: 'Upgrade to generate and save account briefs.' })
      return
    }
    setRegenerating(true)
    setError(null)
    try {
      track('account_brief_generated', { accountId: props.accountId, window: props.signalWindow, refreshSources })
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/brief`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ window: props.signalWindow, force_refresh_sources: refreshSources }),
      })
      const json = (await res.json().catch(() => null)) as PostEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        const msg = json && 'error' in json && typeof json.error?.message === 'string' ? json.error.message : 'Failed to generate brief.'
        setError(msg)
        toast({ variant: 'destructive', title: 'Brief failed', description: msg })
        return
      }
      toast({ variant: 'success', title: 'Brief saved', description: 'Account brief generated.' })
      await load()
    } catch {
      setError('Failed to generate brief.')
      toast({ variant: 'destructive', title: 'Brief failed', description: 'Failed to generate brief.' })
    } finally {
      setRegenerating(false)
    }
  }, [canGenerate, load, props.accountId, props.signalWindow, refreshSources, toast])

  const lastGeneratedLabel = useMemo(() => (brief?.created_at ? formatRelativeDate(brief.created_at) : null), [brief?.created_at])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Account brief</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">window {props.signalWindow}</Badge>
            {brief ? <Badge variant="outline">{lastGeneratedLabel ?? 'Saved'}</Badge> : <Badge variant="outline">Not generated</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {!props.isPro ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-sm font-semibold text-foreground">Upgrade to generate briefs</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Account briefs turn why-now signals into operator-ready next steps and a recommended first touch.
            </div>
            <div className="mt-3">
              <Button size="sm" className="neon-border hover:glow-effect" onClick={() => (window.location.href = '/pricing')}>
                See pricing
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={refreshSources}
              onChange={(e) => setRefreshSources(e.target.checked)}
              disabled={!canGenerate || regenerating}
              className="h-4 w-4 accent-cyan-400"
            />
            Refresh sources before generating
          </label>
          <Button size="sm" className="neon-border hover:glow-effect h-7 text-xs" onClick={() => void onGenerate()} disabled={!canGenerate || regenerating}>
            {regenerating ? 'Generating…' : brief ? 'Regenerate brief' : 'Generate brief'}
          </Button>
          {brief ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(brief.report_markdown)
                  track('account_brief_copied', { accountId: props.accountId })
                  toast({ variant: 'success', title: 'Copied', description: 'Brief copied to clipboard.' })
                } catch {
                  toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
                }
              }}
            >
              Copy brief
            </Button>
          ) : null}
        </div>

        {loading ? <div className="text-xs text-muted-foreground">Loading brief…</div> : null}
        {error ? <div className="text-xs text-red-300">{error}</div> : null}

        {brief ? (
          <div className="rounded border border-cyan-500/10 bg-black/20 p-4">
            <div className="text-xs text-muted-foreground">
              Saved: <span className="text-foreground">{brief.title}</span>
              {brief.sources_fetched_at ? (
                <>
                  {' '}
                  · Sources: <span className="text-foreground">{formatRelativeDate(brief.sources_fetched_at)}</span>
                </>
              ) : null}
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{brief.report_markdown}</pre>
          </div>
        ) : !loading ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
            Generate a brief to get a scannable why-now summary, recommended angle, and first touch for {props.companyName}.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

