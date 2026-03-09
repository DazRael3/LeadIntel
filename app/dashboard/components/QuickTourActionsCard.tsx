'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { useRouter } from 'next/navigation'

export function QuickTourActionsCard() {
  const router = useRouter()
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Setup</div>
            <div className="text-sm text-muted-foreground">A tight loop: targets → why-now → drafts → action.</div>
          </div>
          <Badge variant="outline">Tour targets</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-set-icp"
            onClick={() => {
              track('onboarding_started', { source: 'dashboard_setup', step: 1 })
              router.push('/onboarding?step=1')
            }}
          >
            Choose goal
          </Button>
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-add-accounts"
            onClick={() => {
              track('onboarding_cta_clicked', { source: 'dashboard_setup', step: 2 })
              router.push('/onboarding?step=2')
            }}
          >
            Add targets
          </Button>
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-digest-cadence"
            onClick={() => {
              track('onboarding_cta_clicked', { source: 'dashboard_setup', step: 3 })
              router.push('/onboarding?step=3')
            }}
          >
            Pick workflow
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          You can come back and edit these anytime.
        </div>
      </CardContent>
    </Card>
  )
}

