'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { track } from '@/lib/analytics'

export function BlurredPremiumSection(props: {
  title: string
  preview: string
  lockedReason?: string
  upgradeHref?: string
  eventContext?: { surface: string; section: string }
  onUpgradeClick?: () => void
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (!props.eventContext) return
    if (fired.current) return
    fired.current = true
    track('blurred_section_viewed', props.eventContext)
  }, [props.eventContext])

  return (
    <Card className="relative overflow-hidden border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-cyan-300" />
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="rounded-md border border-cyan-500/10 bg-background/40 p-3">
          <div className="select-none whitespace-pre-wrap text-sm text-foreground blur-sm">{props.preview}</div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {props.lockedReason ?? 'Premium section is locked on Free. Upgrade for full access.'}
          </div>
          <Button
            onClick={() => {
              if (props.eventContext) {
                track('upgrade_cta_clicked_from_blur', props.eventContext)
                track('upgrade_clicked_from_locked_preview', props.eventContext)
              }
              props.onUpgradeClick?.()
              if (props.upgradeHref) window.location.href = props.upgradeHref
            }}
            className="bg-cyan-500 text-black hover:bg-cyan-400"
          >
            Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

