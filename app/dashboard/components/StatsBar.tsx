'use client'

import { Button } from '@/components/ui/button'
import { Activity, TrendingUp, Building2, Mail, Bug } from 'lucide-react'

interface StatsBarProps {
  totalLeads: number
  eventsCount: number
  tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  debugEnabled: boolean
  onDebugClick?: () => void
}

export function StatsBar({ totalLeads, eventsCount, tier, onDebugClick, debugEnabled }: StatsBarProps) {
  const showEmptyHint = totalLeads === 0 && eventsCount === 0
  const accessLabel = tier === 'starter' ? 'Starter' : tier === 'closer' ? 'Closer' : tier === 'closer_plus' ? 'Closer+' : 'Team'
  return (
    <div className="border-b border-cyan-500/10 bg-background/60 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-[260px]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Activity className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Tracked accounts</p>
                <p className="text-xl font-bold neon-cyan">{totalLeads}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Events</p>
                <p className="text-xl font-bold neon-green">{eventsCount}</p>
                {showEmptyHint ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">No activity yet</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Companies</p>
                <p className="text-xl font-bold neon-blue">{totalLeads}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Mail className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Access</p>
                <p className="text-xl font-bold" style={{ color: 'hsl(var(--neon-purple))' }}>
                  {accessLabel}
                </p>
              </div>
            </div>
          </div>
          {/* Debug Button - Only in dev mode */}
          {debugEnabled && onDebugClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDebugClick}
              className="h-7 text-xs border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 ml-4"
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
