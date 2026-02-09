'use client'

import { type ReactNode } from 'react'
import { usePlan } from '@/components/PlanProvider'
import { Button } from '@/components/ui/button'
import { Lock, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'

type RequiredTier = 'closer'
type UpgradeTarget = 'closer'

export function ProGate(props: {
  children: ReactNode
  requiredTier: RequiredTier
  upgradeTarget?: UpgradeTarget
  label?: string
  description?: string
}) {
  const { tier } = usePlan()
  const router = useRouter()
  const upgradeTarget = props.upgradeTarget ?? props.requiredTier
  const allowed = tier === 'closer'

  if (allowed) return <>{props.children}</>

  const ctaLabel = 'Upgrade to Closer'
  const ctaHref = `/pricing?target=${upgradeTarget}`

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-[2px] opacity-50">
        {props.children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border border-purple-500/30 bg-background/85 backdrop-blur-sm p-4 text-center shadow-xl">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-purple-500/30 bg-purple-500/10">
            <Lock className="h-5 w-5 text-purple-300" />
          </div>
          <div className="text-sm font-semibold">{props.label ?? 'Pro feature'}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {props.description ?? 'Unlock real-time signals and automation with the Closer plan.'}
          </div>
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              size="sm"
              className="neon-border hover:glow-effect"
              onClick={() => router.push(ctaHref)}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

