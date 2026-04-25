'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type ScalingMetricsCardProps = {
  windowDays: number
  conversionRatePct: number
  activeUsers: number
  revenueTrend: Array<{ date: string; revenue: number }>
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
  const latestRevenue = useMemo(() => {
    if (props.revenueTrend.length === 0) return 0
    return props.revenueTrend[props.revenueTrend.length - 1]?.revenue ?? 0
  }, [props.revenueTrend])

  const previousRevenue = useMemo(() => {
    if (props.revenueTrend.length < 2) return 0
    return props.revenueTrend[props.revenueTrend.length - 2]?.revenue ?? 0
  }, [props.revenueTrend])

  const revenueDelta = latestRevenue - previousRevenue

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
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Conversion rate</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatPct(props.conversionRatePct)}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Active users</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{props.activeUsers}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Revenue trend</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{formatUsd(latestRevenue)}</div>
            <div className="text-xs text-muted-foreground">
              {revenueDelta >= 0 ? '+' : '-'}
              {formatUsd(Math.abs(revenueDelta))} vs prior period
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
