'use client'

import { Button } from '@/components/ui/button'
import { Activity, TrendingUp, Bug } from 'lucide-react'

interface StatsBarProps {
  totalLeads: number
  eventsCount: number
  debugEnabled: boolean
  onDebugClick?: () => void
}

export function StatsBar({ totalLeads, eventsCount, onDebugClick, debugEnabled }: StatsBarProps) {
  const showEmptyHint = totalLeads === 0 && eventsCount === 0
  return (
    <div className="border-b border-cyan-500/10 bg-background/60 backdrop-blur-sm" data-testid="dashboard-metrics">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:min-w-[260px] sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Activity className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tracked accounts</p>
                <p className="text-lg font-semibold text-foreground">{totalLeads}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-300" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Events</p>
                <p className="text-lg font-semibold text-foreground">{eventsCount}</p>
                {showEmptyHint ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">No activity yet</p>
                ) : null}
              </div>
            </div>
          </div>
          {/* Debug Button - Only in dev mode */}
          {debugEnabled && onDebugClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDebugClick}
              className="ml-0 h-7 bg-yellow-500/10 text-xs text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20 sm:ml-4"
            >
              <Bug className="h-3 w-3 mr-1" />
              Check Auth
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
