'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import { formatRelativeDate, formatSignalType, safeExternalLink } from '@/lib/domain/explainability'
import { track } from '@/lib/analytics'

export function SignalMomentumTimeline(props: {
  accountId: string
  momentum: SignalMomentum | null
  signals: SignalEvent[]
}) {
  useEffect(() => {
    track('signal_momentum_viewed', { accountId: props.accountId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- modal context
  }, [])

  const sorted = useMemo(() => [...props.signals].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 12), [props.signals])
  const hi = props.momentum?.mostRecentHighImpactEvent ?? null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Signal momentum timeline</CardTitle>
          {props.momentum ? <Badge variant="outline">window {props.momentum.window}</Badge> : <Badge variant="outline">—</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {hi ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Most recent high‑impact event</div>
            <div className="mt-1 text-sm text-foreground">{hi.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatRelativeDate(hi.detectedAt)}
              {hi.sourceUrl ? (
                <>
                  {' '}
                  ·{' '}
                  <Link className="text-cyan-400 hover:underline" href={hi.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
            No high-impact event detected in the current window.
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground">No recent signals to show.</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((s) => {
              const src = safeExternalLink(s.sourceUrl)
              return (
                <div key={s.id} className="rounded border border-cyan-500/10 bg-background/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatSignalType(s.type)}</Badge>
                    <span className="text-xs text-muted-foreground" title={new Date(s.detectedAt).toLocaleString()}>
                      {formatRelativeDate(s.detectedAt)}
                    </span>
                    {src ? (
                      <a className="text-xs text-cyan-400 hover:underline" href={src} target="_blank" rel="noreferrer">
                        source
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-foreground">{s.title}</div>
                  {s.summary ? <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.summary}</div> : null}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

