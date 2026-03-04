'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

type Step = 1 | 2 | 3 | 4 | 5 | 6

export function QuickTourActionsCard(props: { onOpenOnboarding: (step: Step) => void }) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Setup</div>
            <div className="text-sm text-muted-foreground">A tight loop: ICP → accounts → daily shortlist.</div>
          </div>
          <Badge variant="outline">Tour targets</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-set-icp"
            onClick={() => {
              track('settings_open_onboarding', { step: 2 })
              props.onOpenOnboarding(2)
            }}
          >
            Set ICP
          </Button>
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-add-accounts"
            onClick={() => {
              track('settings_open_onboarding', { step: 3 })
              props.onOpenOnboarding(3)
            }}
          >
            Add accounts
          </Button>
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-digest-cadence"
            onClick={() => {
              track('settings_open_onboarding', { step: 4 })
              props.onOpenOnboarding(4)
            }}
          >
            Digest cadence
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          You can come back and edit these anytime.
        </div>
      </CardContent>
    </Card>
  )
}

