'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, DollarSign, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'
import { useStripePortal } from '../hooks/useStripePortal'

interface DashboardHeaderSectionProps {
  isPro: boolean
  creditsRemaining: number
}

export function DashboardHeaderSection({ isPro, creditsRemaining }: DashboardHeaderSectionProps) {
  const router = useRouter()
  const { openPortal } = useStripePortal()

  return (
    <header className="border-b border-cyan-500/20 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">LEADINTEL</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PROFESSIONAL TERMINAL</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Credits Display */}
            <Card className="border-cyan-500/20 bg-card/50 px-4 py-2">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Credits</p>
                  <p className="text-sm font-bold neon-cyan">
                    {isPro ? '∞ Unlimited' : creditsRemaining}
                  </p>
                </div>
              </div>
            </Card>

            {/* Subscription Badge - Only show Pro badge, never show Free badge */}
            {isPro && (
              <Badge 
                variant="default" 
                className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
              >
                <Shield className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            )}

            {/* Upgrade button - Only show for Free users */}
            {!isPro && (
              <Button 
                variant="outline" 
                onClick={() => router.push('/pricing')}
                className="neon-border hover:glow-effect"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
            {isPro && (
              <Button
                variant="outline"
                onClick={openPortal}
                className="neon-border hover:glow-effect"
              >
                <Shield className="h-4 w-4 mr-2" />
                Manage billing
              </Button>
            )}
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  )
}
