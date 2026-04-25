'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type ScalingMetricsCardProps = {
  windowDays: number
  dailyUsers: number
  demoRatePct: number
  signupRatePct: number
  paidConversions: number
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function ScalingMetricsCard(props: ScalingMetricsCardProps) {
  const dailyTargetGap = useMemo(() => {
    // Directional framing only: approx. revenue gap toward a $10k monthly target.
    const monthlyRevenueEstimate = props.paidConversions * 79
    return Math.max(0, 10000 - monthlyRevenueEstimate)
  }, [props.paidConversions])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Scaling metrics</CardTitle>
          <Badge variant="outline">window {props.windowDays}d</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Daily users</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{props.dailyUsers}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Demo rate</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatPct(props.demoRatePct)}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Signup rate</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatPct(props.signupRatePct)}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Paid conversions</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{props.paidConversions}</div>
            <div className="text-xs text-muted-foreground">Completed payments in selected window</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">$10k/month directional gap</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatUsd(dailyTargetGap)}</div>
            <div className="text-xs text-muted-foreground">
              Approximate daily gap to 10k/month pace.
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Directional metrics for internal funnel optimization only.
        </div>
      </CardContent>
    </Card>
  )
}
