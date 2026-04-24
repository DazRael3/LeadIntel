'use client'

import Link from 'next/link'
import type { Tier } from '@/lib/billing/tier'
import { type ProductPlanDetails } from '@/lib/billing/product-plan'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useStripePortal } from '@/app/dashboard/hooks/useStripePortal'

export function BillingSettingsClient(props: {
  email: string | null
  tier: Tier
  plan: ProductPlanDetails
}) {
  const { openPortal } = useStripePortal()

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your subscription and usage limits.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current plan</CardTitle>
            <CardDescription>
              Billing plan for <span className="text-foreground">{props.email ?? 'your account'}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{props.plan.label}</Badge>
              <span>Tier key: {props.tier}</span>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Lead generations: {typeof props.plan.leadGenerationLimit === 'number' ? `${props.plan.leadGenerationLimit} max` : 'unlimited'}
              </li>
              <li>
                AI pitches (monthly): {typeof props.plan.aiPitchLimit === 'number' ? `${props.plan.aiPitchLimit} max` : 'unlimited'}
              </li>
              <li>Exports: {props.plan.exportsEnabled ? 'enabled' : 'not included'}</li>
              <li>Campaign automation: {props.plan.campaignAutomationEnabled ? 'enabled' : 'not included'}</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild>
                <Link href={props.plan.plan === 'free' ? '/pricing?target=closer' : '/pricing?target=team'}>
                  {props.plan.plan === 'free' ? 'Upgrade to Pro' : 'Upgrade to Agency'}
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void openPortal()
                }}
              >
                Open Stripe billing portal
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
