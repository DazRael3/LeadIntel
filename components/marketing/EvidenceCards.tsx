'use client'

import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowRight, FileCheck2, ShieldCheck, Sparkles } from 'lucide-react'

type Evidence = {
  title: string
  badge: string
  body: string
  links: { href: string; label: string }[]
  icon: ComponentType<{ className?: string }>
}

const EVIDENCE: Evidence[] = [
  {
    title: 'Deterministic 0–100 scoring with visible reasons',
    badge: 'Explainable score',
    body:
      'LeadIntel prioritizes accounts with a deterministic scoring model and visible reasons so reps can trust what rises, and why.',
    links: [
      { href: '/how-scoring-works', label: 'How scoring works' },
      { href: '/tour', label: 'See it in the tour' },
    ],
    icon: FileCheck2,
  },
  {
    title: 'Public sample flow without signup',
    badge: 'Low-friction evaluation',
    body: 'Generate a sample digest and understand the workflow before you buy. No demo-first gates required to see value.',
    links: [
      { href: '/#try-sample', label: 'Generate a sample digest' },
      { href: '/pricing', label: 'See pricing' },
    ],
    icon: Sparkles,
  },
  {
    title: 'Webhook delivery and export support',
    badge: 'Action layer',
    body:
      'Turn intel into action: deliver signed webhooks to downstream systems or export data for your workflow. This is built-in—no fake CRM OAuth required.',
    links: [
      { href: '/settings/integrations', label: 'Integrations (Team)' },
      { href: '/settings/exports', label: 'Exports (Team)' },
    ],
    icon: ArrowRight,
  },
  {
    title: 'Public trust and policy pages buyers can inspect',
    badge: 'Trust Center',
    body: 'Security, privacy, and operational transparency are public so buyers can verify what exists today.',
    links: [
      { href: '/trust', label: 'Trust Center' },
      { href: '/status', label: 'Status' },
    ],
    icon: ShieldCheck,
  },
]

export function EvidenceCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {EVIDENCE.map((e) => {
        const Icon = e.icon
        return (
          <Card key={e.title} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{e.title}</CardTitle>
                <Badge variant="outline" className="li-chip">
                  {e.badge}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10">
                  <Icon className="h-4 w-4 li-accent" />
                </div>
                <div className="text-sm text-muted-foreground">{e.body}</div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {e.links.map((l) => (
                  <Link key={l.href + l.label} className="li-accent-link" href={l.href}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

