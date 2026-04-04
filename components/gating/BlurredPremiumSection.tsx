'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'
import { track } from '@/lib/analytics'

export function BlurredPremiumSection(props: {
  title: string
  preview: string
  lockedReason?: string
  upgradeHref?: string
  secondaryCtaHref?: string
  secondaryCtaLabel?: string
  continueCtaHref?: string
  continueCtaLabel?: string
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

  const upgradeHref = props.upgradeHref ?? '/pricing'
  const secondaryCtaHref = props.secondaryCtaHref ?? '/pricing'
  const secondaryCtaLabel = props.secondaryCtaLabel ?? 'See pricing'
  const continueCtaHref = props.continueCtaHref ?? '/dashboard'
  const continueCtaLabel = props.continueCtaLabel ?? 'Continue in Dashboard'

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

        <div className="mt-3 space-y-3">
          <div className="text-xs text-muted-foreground">
            {props.lockedReason ?? 'Premium section is locked on Free. Upgrade for full access.'}
          </div>
          <div className="text-[11px] text-muted-foreground">Unlock path: Closer or higher plan.</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                if (props.eventContext) {
                  track('upgrade_cta_clicked_from_blur', props.eventContext)
                  track('upgrade_clicked_from_locked_preview', props.eventContext)
                }
                props.onUpgradeClick?.()
                window.location.href = upgradeHref
              }}
              className="bg-cyan-500 text-black hover:bg-cyan-400"
            >
              Upgrade
            </Button>
            <Button asChild variant="outline">
              <Link href={secondaryCtaHref}>{secondaryCtaLabel}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={continueCtaHref}>{continueCtaLabel}</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

