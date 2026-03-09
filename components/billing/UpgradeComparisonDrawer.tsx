'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type Tier = 'closer' | 'closer_plus' | 'team'

function bulletsFor(tier: Tier): string[] {
  if (tier === 'team') {
    return [
      'Shared templates with approvals',
      'Audit visibility for governance',
      'Webhook/export actions for handoff',
    ]
  }
  if (tier === 'closer_plus') {
    return [
      'Everything in Closer',
      'Deeper source-backed context',
      'Refresh sources + regenerate',
    ]
  }
  return [
    'Unlimited generation',
    'Full saved outputs (no blurred sections)',
    'Account briefs + action center',
  ]
}

export function UpgradeComparisonDrawer(props: { source: string; defaultTier?: Tier }) {
  const [open, setOpen] = useState(false)
  const tier = props.defaultTier ?? 'closer'

  const rows = useMemo(() => {
    return [
      { tier: 'closer' as const, title: 'Closer', helper: 'Run daily outbound with full visibility.' },
      { tier: 'closer_plus' as const, title: 'Closer+', helper: 'Deeper context and refresh capability.' },
      { tier: 'team' as const, title: 'Team', helper: 'Shared workflow and governance.' },
    ]
  }, [])

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) track('upgrade_cta_viewed', { source: props.source, surface: 'upgrade_comparison_drawer' })
        }}
      >
        {open ? 'Hide plan comparison' : 'Compare plans'}
      </Button>

      {open ? (
        <Card className="border-cyan-500/20 bg-card/40">
          <CardContent className="pt-4 space-y-3 text-sm text-muted-foreground">
            <div className="text-xs text-muted-foreground">
              Pricing is transparent in-app. No fake enterprise claims.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {rows.map((r) => (
                <div key={r.tier} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="text-sm font-semibold text-foreground">{r.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.helper}</div>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                    {bulletsFor(r.tier).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <Button
                      asChild
                      size="sm"
                      className="w-full neon-border hover:glow-effect"
                      onClick={() => track('upgrade_cta_clicked', { source: props.source, target: r.tier })}
                    >
                      <Link href={`/pricing?target=${r.tier}`}>View {r.title}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Default recommendation: <span className="text-foreground font-medium">{tier.replace('_', '+')}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

