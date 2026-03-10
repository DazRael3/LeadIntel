'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

type Attribution = {
  type: 'attribution_support_summary'
  workspaceId: string
  accountId: string
  label: string
  verification: { label: string; note: string }
  whatIsVerified: string[]
  whatIsInferred: string[]
  whatIsMissing: string[]
  limitationsNote: string
  computedAt: string
}

type Envelope = { ok: true; data: Attribution } | { ok: false; error?: { message?: string } }

export function AttributionSupportCard(props: { accountId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Attribution | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/accounts/${props.accountId}/attribution-support`, { cache: 'no-store', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as Envelope | null
        if (cancelled) return
        if (!res.ok || !json || json.ok !== true) {
          setData(null)
          return
        }
        setData(json.data)
        track('attribution_support_viewed', { accountId: props.accountId })
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.accountId])

  const badge = useMemo(() => {
    const label = data?.label ?? 'insufficient_crm_data'
    const tone =
      label === 'verified_downstream_support'
        ? 'border-green-500/30 text-green-300 bg-green-500/10'
        : label === 'ambiguous_support'
          ? 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
          : 'border-cyan-500/20'
    return { label: label.replaceAll('_', ' '), tone }
  }, [data?.label])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Attribution support</CardTitle>
          <Badge variant="outline" className={badge.tone}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? <div>Loading…</div> : null}
        {!loading && !data ? <div className="rounded border border-cyan-500/10 bg-background/40 p-3">Unavailable.</div> : null}
        {!loading && data ? (
          <>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs">
              <div className="text-muted-foreground">Verification</div>
              <div className="mt-1 text-foreground">{data.verification.note}</div>
            </div>
            <EvidenceList title="Verified" items={data.whatIsVerified} />
            <EvidenceList title="Inferred" items={data.whatIsInferred} />
            <EvidenceList title="Missing" items={data.whatIsMissing} />
            <div className="text-xs text-muted-foreground">{data.limitationsNote}</div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EvidenceList(props: { title: string; items: string[] }) {
  return (
    <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{props.title}</div>
      <div className="mt-2 space-y-1">
        {props.items.length === 0 ? <div className="text-xs text-muted-foreground">None</div> : null}
        {props.items.slice(0, 6).map((t, idx) => (
          <div key={`${props.title}-${idx}`} className="text-xs text-foreground">
            {t}
          </div>
        ))}
      </div>
    </div>
  )
}

