'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { Copy, Download, Send, Sparkles, Lock } from 'lucide-react'

type ExportEnvelope =
  | { ok: true; data: { jobId: string } }
  | { ok: false; error?: { code?: string; message?: string } }

type PushEnvelope =
  | { ok: true; data: { eventId: string } }
  | { ok: false; error?: { code?: string; message?: string } }

type BriefEnvelope =
  | { ok: true; data: { reportId: string } }
  | { ok: false; error?: { code?: string; message?: string } }

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AccountActionCenter(props: {
  accountId: string
  companyName: string
  window: '7d' | '30d' | '90d' | 'all'
  whyNowSummary: string
  opener: string | null
  onBriefGenerated?: () => void
}) {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [briefing, setBriefing] = useState(false)

  const canCopyOpener = useMemo(() => typeof props.opener === 'string' && props.opener.trim().length > 0, [props.opener])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Action center</CardTitle>
          <Badge variant="outline">window {props.window}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              track('account_action_copy_opener', { kind: 'why_now', accountId: props.accountId })
              const ok = await copyToClipboard(props.whyNowSummary)
              toast(ok ? { variant: 'success', title: 'Copied', description: 'Why-now summary copied.' } : { variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy why-now summary
          </Button>

          <Button
            variant="outline"
            disabled={!canCopyOpener}
            onClick={async () => {
              track('account_action_copy_opener', { kind: 'opener', accountId: props.accountId })
              const ok = await copyToClipboard((props.opener ?? '').trim())
              toast(ok ? { variant: 'success', title: 'Copied', description: 'Outreach opener copied.' } : { variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy outreach opener
          </Button>

          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try {
                track('account_export_requested', { accountId: props.accountId })
                const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/export`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ window: props.window }),
                })
                const json = (await res.json().catch(() => null)) as ExportEnvelope | null
                if (!res.ok || !json || json.ok !== true) {
                  if (res.status === 403) {
                    toast({ variant: 'destructive', title: 'Team feature', description: 'Export actions require the Team plan.' })
                    window.location.href = '/pricing?target=team'
                    return
                  }
                  toast({ variant: 'destructive', title: 'Export failed', description: json && 'error' in json && typeof json.error?.message === 'string' ? json.error.message : 'Export failed.' })
                  return
                }
                toast({ variant: 'success', title: 'Export ready', description: 'Downloading CSV…' })
                window.location.href = `/api/exports/${encodeURIComponent(json.data.jobId)}/download`
              } finally {
                setExporting(false)
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export account CSV
          </Button>

          <Button
            variant="outline"
            disabled={pushing}
            onClick={async () => {
              setPushing(true)
              try {
                track('account_webhook_push_requested', { accountId: props.accountId })
                const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/push`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ window: props.window }),
                })
                const json = (await res.json().catch(() => null)) as PushEnvelope | null
                if (!res.ok || !json || json.ok !== true) {
                  if (res.status === 403) {
                    toast({ variant: 'destructive', title: 'Team feature', description: 'Webhook actions require the Team plan.' })
                    window.location.href = '/pricing?target=team'
                    return
                  }
                  toast({ variant: 'destructive', title: 'Push failed', description: json && 'error' in json && typeof json.error?.message === 'string' ? json.error.message : 'Push failed.' })
                  return
                }
                toast({ variant: 'success', title: 'Queued', description: 'Webhook delivery queued.' })
              } finally {
                setPushing(false)
              }
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            Send payload to webhook
          </Button>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Brief</div>
            <Badge variant="outline">Saved to Reports</Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Generate a scannable why-now brief with recommended persona targets and a first touch.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="neon-border hover:glow-effect h-7 text-xs"
              disabled={briefing}
              onClick={async () => {
                setBriefing(true)
                try {
                  const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/brief`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ window: props.window }),
                  })
                  const json = (await res.json().catch(() => null)) as BriefEnvelope | null
                  if (!res.ok || !json || json.ok !== true) {
                    if (res.status === 403) {
                      toast({ variant: 'destructive', title: 'Upgrade required', description: 'Upgrade to generate and save briefs.' })
                      window.location.href = '/pricing?target=closer'
                      return
                    }
                    toast({ variant: 'destructive', title: 'Brief failed', description: json && 'error' in json && typeof json.error?.message === 'string' ? json.error.message : 'Brief failed.' })
                    return
                  }
                  toast({ variant: 'success', title: 'Brief saved', description: 'Account brief generated.' })
                  props.onBriefGenerated?.()
                } finally {
                  setBriefing(false)
                }
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate account brief
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                window.location.href = '/pricing'
              }}
            >
              <Lock className="h-4 w-4 mr-2" />
              Open pricing
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

