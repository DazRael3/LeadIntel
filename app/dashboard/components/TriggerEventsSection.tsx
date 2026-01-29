'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Activity, AlertCircle, TrendingUp } from 'lucide-react'
import { formatErrorMessage } from '@/lib/utils/format-error'
import type { TriggerEvent } from '@/lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'

interface TriggerEventsSectionProps {
  events: TriggerEvent[]
  loading: boolean
  error: string | null
  onRefresh: () => void
  companyDomain?: string | null
  companyLabel?: string | null
  lastUpdatedAt?: string | null
  debugEnabled?: boolean
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function TriggerEventsSection({
  events,
  loading,
  error,
  onRefresh,
  companyDomain,
  companyLabel,
  lastUpdatedAt,
  debugEnabled,
}: TriggerEventsSectionProps) {
  const title = companyDomain
    ? `Trigger Events for ${companyLabel || companyDomain}`
    : companyLabel
      ? `Trigger Events for ${companyLabel}`
      : 'Trigger Events'

  const subtitle = companyDomain
    ? `Signals for ${companyDomain}`
    : 'Near real-time B2B signals from business, tech, and financial feeds'

  return (
    <Card className="mb-6 border-cyan-500/20 bg-card/50">
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
            {debugEnabled && lastUpdatedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Last updated {formatDistanceToNow(new Date(lastUpdatedAt), { addSuffix: true })}
              </p>
            ) : null}
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
              Loading trigger events…
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-cyan-500/10 bg-background/20 p-4 animate-pulse">
                <div className="h-4 w-2/3 bg-muted/40 rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted/30 rounded mb-3" />
                <div className="h-3 w-1/3 bg-muted/20 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Events</h3>
            <p className="text-muted-foreground mb-4">
              {typeof error === 'string' ? error : formatErrorMessage(error)}
            </p>
            <Button onClick={onRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No trigger events yet</h3>
            <p className="text-muted-foreground mb-4">
              We’re watching the feeds — check back soon, or generate a pitch to start tracking a company.
            </p>
            <p className="text-sm text-muted-foreground">
              Events are near real-time and may take a moment to populate.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-4 rounded-lg border border-cyan-500/20 bg-background/30 hover:bg-background/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{event.company_name}</h3>
                      {event.company_domain ? <span className="text-xs text-muted-foreground">({event.company_domain})</span> : null}
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <a
                        href={event.source_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-cyan-200 hover:underline line-clamp-2"
                      >
                        {event.headline || event.event_description}
                      </a>
                    </div>
                    {event.event_description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{event.event_description}</p>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {event.source_url ? (
                        <span className="rounded border border-cyan-500/10 bg-background/20 px-2 py-0.5">
                          {hostFromUrl(event.source_url) ?? 'Source'}
                        </span>
                      ) : null}
                      <span title={new Date(event.detected_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(event.detected_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
