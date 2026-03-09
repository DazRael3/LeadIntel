'use client'

import { useActivationV2 } from '@/components/dashboard/useActivationV2'
import { PlanValueCallout } from '@/components/billing/PlanValueCallout'
import { UpgradeComparisonDrawer } from '@/components/billing/UpgradeComparisonDrawer'

export function UpgradeReasonsCard() {
  const { model } = useActivationV2()
  if (!model) return null

  const isStarter = model.capabilities.tier === 'starter'
  if (!isStarter) return null

  const remaining = model.usage.remaining
  const shouldShow = remaining <= 1 || model.activation.completedCount >= 4
  if (!shouldShow) return null

  return (
    <div className="space-y-3">
      <PlanValueCallout
        tier="closer"
        title="Why upgrade"
        bullets={[
          'Unlock full saved outputs (no blurred sections).',
          'Keep briefs and reports reusable across touches.',
          'Use persona-aware actions and operational handoff.',
        ]}
        ctaHref="/pricing?target=closer"
        ctaLabel="Upgrade to Closer"
        eventSource="dashboard_upgrade_reasons"
      />
      <UpgradeComparisonDrawer source="dashboard_upgrade_reasons" defaultTier="closer" />
    </div>
  )
}

