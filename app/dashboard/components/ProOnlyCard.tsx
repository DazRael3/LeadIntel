'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Lock, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PaidTier } from '@/lib/billing/tier'
import { tierLabel } from '@/lib/billing/tier'

interface ProOnlyCardProps {
  title: string
  description: string
  icon: 'shield' | 'lock'
  iconColor?: 'cyan' | 'purple'
  upgradeTarget?: PaidTier
}

export function ProOnlyCard({ title, description, icon, iconColor = 'cyan', upgradeTarget = 'closer' }: ProOnlyCardProps) {
  const router = useRouter()
  const IconComponent = icon === 'shield' ? Shield : Lock
  
  const borderClass = iconColor === 'purple' 
    ? 'border-purple-500/30' 
    : 'border-cyan-500/30'
  const iconClass = iconColor === 'purple'
    ? 'text-purple-400'
    : 'text-cyan-400'

  return (
    <Card className={`${borderClass} bg-card/60`}>
      <CardContent className="py-8 text-center space-y-4">
        <IconComponent className={`h-10 w-10 mx-auto ${iconClass}`} />
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
        <div className="text-xs text-muted-foreground">
          Unlock path: {tierLabel(upgradeTarget)} or higher. You can continue working in Dashboard without upgrading.
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push(`/pricing?target=${upgradeTarget}`)} className="neon-border hover:glow-effect">
            <DollarSign className="h-4 w-4 mr-2" />
            Upgrade to {tierLabel(upgradeTarget)}
          </Button>
          <Button variant="outline" onClick={() => router.push('/pricing')}>
            See pricing
          </Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')}>
            Continue in Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
