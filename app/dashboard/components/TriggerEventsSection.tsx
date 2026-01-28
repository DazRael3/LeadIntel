'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Activity, AlertCircle, TrendingUp } from 'lucide-react'
import { formatErrorMessage } from '@/lib/utils/format-error'
import type { TriggerEvent } from '@/lib/supabaseClient'

interface TriggerEventsSectionProps {
  events: TriggerEvent[]
  loading: boolean
  error: string | null
  onRefresh: () => void
}

export function TriggerEventsSection({ events, loading, error, onRefresh }: TriggerEventsSectionProps) {
  return (
    <Card className="mb-6 border-cyan-500/20 bg-card/50">
      <div className="p-4 border-b border-cyan-500/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Trigger Events</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time B2B intelligence alerts
            </p>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      <CardContent className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto mb-4 text-cyan-400 animate-pulse" />
            <p className="text-muted-foreground">Loading trigger events...</p>
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
              Run your first AI pitch, or wait for new events from the intelligence feed to appear here.
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
                      {event.company_domain && (
                        <span className="text-xs text-muted-foreground">({event.company_domain})</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{event.headline || event.event_description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.detected_at).toLocaleString()}
                    </p>
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
