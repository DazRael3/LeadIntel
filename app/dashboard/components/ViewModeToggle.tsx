'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Building2 } from 'lucide-react'

interface ViewModeToggleProps {
  viewMode: 'startup' | 'enterprise'
  onViewModeChange: (mode: 'startup' | 'enterprise') => void
}

export function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">View Mode:</span>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'startup' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('startup')}
                className={viewMode === 'startup' 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' 
                  : 'border-cyan-500/20'}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Startup
              </Button>
              <Button
                variant={viewMode === 'enterprise' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onViewModeChange('enterprise')}
                className={viewMode === 'enterprise' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' 
                  : 'border-cyan-500/20'}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Enterprise
              </Button>
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            {viewMode === 'startup' ? 'Highlighting High Growth Potential' : 'Highlighting Enterprise Stability'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
