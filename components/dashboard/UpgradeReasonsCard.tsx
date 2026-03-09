'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { useActivationV2 } from '@/components/dashboard/useActivationV2'

export function UpgradeReasonsCard() {
  const { model } = useActivationV2()
  if (!model) return null

  const isStarter = model.capabilities.tier === 'starter'
  if (!isStarter) return null

  const remaining = model.usage.remaining
  const shouldShow = remaining <= 1 || model.activation.completedCount >= 4
  if (!shouldShow) return null

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Why upgrade</CardTitle>
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-300">
            Preview → Daily execution
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <ul className="list-disc pl-5 space-y-1">
          <li>Unlock full saved outputs (no blurred sections).</li>
          <li>Keep briefs and reports reusable across touches.</li>
          <li>Use persona-aware actions and operational handoff (exports/webhooks where applicable).</li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            asChild
            size="sm"
            className="neon-border hover:glow-effect"
            onClick={() => {
              track('upgrade_cta_clicked', { source: 'dashboard_upgrade_reasons', target: 'closer' })
            }}
          >
            <Link href="/pricing?target=closer">Upgrade to Closer</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            onClick={() => track('trust_center_cta_clicked', { source: 'dashboard_upgrade_reasons' })}
          >
            <Link href="/trust">Review trust center</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

