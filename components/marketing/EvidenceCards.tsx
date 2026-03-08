'use client'

import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowRight, FileCheck2, ShieldCheck, Webhook } from 'lucide-react'

type Evidence = {
  title: string
  badge: string
  body: string
  links: { href: string; label: string }[]
  icon: ComponentType<{ className?: string }>
}

const EVIDENCE: Evidence[] = [
  {
    title: 'Deterministic 0–100 scoring with reasons',
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
    title: 'First-party + external signal coverage (when available)',
    badge: 'Why-now intelligence',
    body:
      'LeadIntel can combine first-party sources (your targets’ public pages) and external signals. When sources are thin, the product is explicit and conservative.',
    links: [
      { href: '/security', label: 'Security overview' },
      { href: '/status', label: 'Status & automation' },
    ],
    icon: Webhook,
  },
  {
    title: 'Webhook delivery + export support',
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
    title: 'Team playbooks + governance',
    badge: 'Team workflow',
    body:
      'Team includes shared templates, approval flows, and audit logs to standardize messaging and visibility across reps—without losing speed.',
    links: [
      { href: '/templates', label: 'Templates library' },
      { href: '/settings/templates', label: 'Governed templates (Team)' },
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
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  {e.badge}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10">
                  <Icon className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="text-sm text-muted-foreground">{e.body}</div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {e.links.map((l) => (
                  <Link key={l.href + l.label} className="text-cyan-400 hover:underline" href={l.href}>
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

