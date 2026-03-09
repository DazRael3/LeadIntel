'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export type PlanValueTier = 'starter' | 'closer' | 'closer_plus' | 'team'

function tierLabel(tier: PlanValueTier): string {
  if (tier === 'starter') return 'Starter'
  if (tier === 'closer') return 'Closer'
  if (tier === 'closer_plus') return 'Closer+'
  return 'Team'
}

export function PlanValueCallout(props: {
  tier: PlanValueTier
  title: string
  bullets: string[]
  ctaHref: string
  ctaLabel: string
  eventSource: string
}) {
  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{props.title}</CardTitle>
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-300">
            {tierLabel(props.tier)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <ul className="list-disc pl-5 space-y-1">
          {props.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            asChild
            size="sm"
            className="neon-border hover:glow-effect"
            onClick={() => track('upgrade_cta_clicked', { source: props.eventSource, target: props.tier })}
          >
            <Link href={props.ctaHref}>{props.ctaLabel}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            onClick={() => track('trust_center_cta_clicked', { source: props.eventSource })}
          >
            <Link href="/trust">Review trust center</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

