'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export type UpgradeTargetTier = 'closer' | 'closer_plus' | 'team'
export type UpgradeReason =
  | 'locked_preview'
  | 'free_limit_reached'
  | 'saved_outputs'
  | 'team_workflow'
  | 'advanced_signals'
  | 'action_center'

function tierLabel(tier: UpgradeTargetTier): string {
  if (tier === 'closer') return 'Closer'
  if (tier === 'closer_plus') return 'Closer+'
  return 'Team'
}

function tierPositioning(tier: UpgradeTargetTier): { headline: string; subhead: string; bullets: string[] } {
  if (tier === 'team') {
    return {
      headline: 'Standardize and scale the workflow',
      subhead: 'Team unlocks shared templates, approvals, and operational governance.',
      bullets: ['Shared templates with approvals', 'Audit visibility for rollout', 'Webhook/export actions for operational handoff'],
    }
  }
  if (tier === 'closer_plus') {
    return {
      headline: 'Deeper context for operators',
      subhead: 'Closer+ adds deeper source-backed context and refresh/regenerate capability.',
      bullets: ['Everything in Closer', 'More source freshness visibility', 'Refresh sources + regenerate when timing changes'],
    }
  }
  return {
    headline: 'Run daily outbound with full visibility',
    subhead: 'Closer unlocks full content access and makes the action layer reusable.',
    bullets: ['Full saved outputs (no blurred sections)', 'Account briefs you can regenerate and reuse', 'Persona-aware actions and packaged exports'],
  }
}

function reasonCopy(reason: UpgradeReason): { label: string; helper: string } {
  if (reason === 'free_limit_reached') return { label: 'Free limit reached', helper: 'Free plan is designed for previewing the workflow.' }
  if (reason === 'locked_preview') return { label: 'Locked preview', helper: 'Full premium content stays locked until you upgrade.' }
  if (reason === 'saved_outputs') return { label: 'Saved outputs', helper: 'Move from one-off previews to reusable assets.' }
  if (reason === 'team_workflow') return { label: 'Team workflow', helper: 'Standardize templates and approvals across reps.' }
  if (reason === 'advanced_signals') return { label: 'Deeper signals', helper: 'Unlock deeper context and advanced surfaces.' }
  return { label: 'Action center', helper: 'Upgrade to unlock premium actions.' }
}

export function UpgradeExplainer(props: {
  target: UpgradeTargetTier
  reason: UpgradeReason
  source: string
  compact?: boolean
}) {
  const pos = tierPositioning(props.target)
  const r = reasonCopy(props.reason)
  const href = `/pricing?target=${props.target}`

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{pos.headline}</CardTitle>
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-300">
            {tierLabel(props.target)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="rounded border border-purple-500/20 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{r.helper}</div>
        </div>
        <div className="text-sm text-muted-foreground">{pos.subhead}</div>
        {!props.compact ? (
          <ul className="list-disc pl-5 space-y-1">
            {pos.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild size="sm" className="neon-border hover:glow-effect" onClick={() => track('upgrade_cta_clicked', { source: props.source, reason: props.reason, target: props.target })}>
            <Link href={href}>View plans</Link>
          </Button>
          <Button asChild size="sm" variant="outline" onClick={() => track('trust_center_cta_clicked', { source: props.source })}>
            <Link href="/trust">Review trust/security</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

