'use client'

import { Button } from '@/components/ui/button'
import { Activity, TrendingUp, Building2, Mail, Bug } from 'lucide-react'

interface StatsBarProps {
  totalLeads: number
  eventsCount: number
  isPro: boolean
  isDev: boolean
  onDebugClick?: () => void
}

export function StatsBar({ totalLeads, eventsCount, isPro, onDebugClick, isDev }: StatsBarProps) {
  return (
    <div className="border-b border-cyan-500/10 bg-background/60 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-4 gap-6 flex-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Activity className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Leads</p>
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
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Building2 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Companies</p>
                <p className="text-xl font-bold neon-blue">-</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Mail className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Access</p>
                <p className="text-xl font-bold" style={{ color: 'hsl(var(--neon-purple))' }}>
                  {isPro ? 'Full' : 'Limited'}
                </p>
              </div>
            </div>
          </div>
          {/* Debug Button - Only in dev mode */}
          {isDev && onDebugClick && (
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
