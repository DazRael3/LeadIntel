'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { FirstPartyIntent } from '@/lib/domain/explainability'
import { formatRelativeDate } from '@/lib/domain/explainability'
import { track } from '@/lib/analytics'

type SourcesStatusEnvelope =
  | { ok: true; data: { company_key: string; sources: Record<string, { status: 'ok' | 'error'; fetched_at: string; expires_at: string; citations_count: number }> } }
  | { ok: false; error?: { message?: string } }

function safeLink(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export function FirstPartyIntentCard(props: {
  companyName: string | null
  companyDomain: string | null
  inputUrl: string | null
  firstPartyIntent: FirstPartyIntent
}) {
  const [sourcesStatus, setSourcesStatus] = useState<{ firstParty: { status: 'ok' | 'error'; fetchedAt: string } | null } | null>(null)
  const [loadingSources, setLoadingSources] = useState(false)

  const domain = (props.companyDomain ?? '').trim()
  const inputUrl = (props.inputUrl ?? '').trim()
  const canCheckSources = domain.length > 0 || inputUrl.length > 0 || (props.companyName ?? '').trim().length > 0

  const visitor = props.firstPartyIntent.visitorMatches
  const hasVisitors = visitor.count > 0

  const refreshSourcesStatus = async () => {
    if (!canCheckSources) return
    setLoadingSources(true)
    try {
      const qs = new URLSearchParams()
      if (domain) qs.set('company_domain', domain)
      if (inputUrl) qs.set('input_url', inputUrl)
      if (!domain && !inputUrl && props.companyName) qs.set('company_name', props.companyName)

      const res = await fetch(`/api/sources/status?${qs.toString()}`, { method: 'GET', cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as SourcesStatusEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        setSourcesStatus({ firstParty: null })
        return
      }
      const firstParty = json.data.sources?.first_party
      if (firstParty && typeof firstParty.fetched_at === 'string') {
        setSourcesStatus({ firstParty: { status: firstParty.status, fetchedAt: firstParty.fetched_at } })
      } else {
        setSourcesStatus({ firstParty: null })
      }
    } catch {
      setSourcesStatus({ firstParty: null })
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    void refreshSourcesStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only; this card is inside a modal
  }, [])

  const websiteHref = useMemo(() => (domain ? safeLink(`https://${domain}`) : inputUrl ? safeLink(inputUrl) : null), [domain, inputUrl])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">First-party intent</CardTitle>
          {domain ? <Badge variant="outline">{domain}</Badge> : <Badge variant="outline">—</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Website visitors (matched)</div>
            <Badge variant="outline">{visitor.count}</Badge>
          </div>
          {hasVisitors ? (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-muted-foreground">
                Most recent: <span className="text-foreground font-medium">{visitor.lastVisitedAt ? formatRelativeDate(visitor.lastVisitedAt) : '—'}</span>
              </div>
              {visitor.sampleReferrers.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  Sample pages:
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    {visitor.sampleReferrers.map((r) => (
                      <li key={r}>
                        <a className="text-cyan-400 hover:underline" href={r} target="_blank" rel="noreferrer">
                          {r}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">No recent visitor matches for this domain.</div>
          )}
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">First-party source availability</div>
            <Badge variant="outline">
              {sourcesStatus?.firstParty ? (sourcesStatus.firstParty.status === 'ok' ? 'Available' : 'Error') : 'Not fetched'}
            </Badge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {sourcesStatus?.firstParty
              ? `Last fetched: ${formatRelativeDate(sourcesStatus.firstParty.fetchedAt)}`
              : 'Fetch sources to pull first-party pages for reports and briefs.'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loadingSources || !canCheckSources}
              onClick={() => {
                track('tour_workspace_interacted', { surface: 'account_first_party_intent_refresh' })
                void refreshSourcesStatus()
              }}
              className="h-7 text-xs"
            >
              {loadingSources ? 'Refreshing…' : 'Refresh status'}
            </Button>
            {websiteHref ? (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <a href={websiteHref} target="_blank" rel="noreferrer">
                  Open website
                </a>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href="/competitive-report/new">Generate competitive report</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Intent is shown only when it exists. LeadIntel won’t fabricate first-party activity.
        </div>
      </CardContent>
    </Card>
  )
}

