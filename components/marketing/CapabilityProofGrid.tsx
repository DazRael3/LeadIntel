'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type ProofItem = {
  title: string
  body: string
  tag: string
}

const ITEMS: ProofItem[] = [
  {
    title: 'Explainable scoring (not black-box ranking)',
    tag: 'Explainability',
    body: 'Every score is grounded in visible inputs and reasons. Reps can sanity-check the “why” before acting.',
  },
  {
    title: 'Account timing + outreach in one flow',
    tag: 'Workflow',
    body: 'Signals don’t end as alerts. You can move from “why now” to a send-ready first touch without switching tools.',
  },
  {
    title: 'Shared team workflow (not just solo output)',
    tag: 'Team',
    body: 'Teams can standardize templates with approvals and audit visibility so execution stays consistent across reps.',
  },
  {
    title: 'Inspectable trust and pricing before sales contact',
    tag: 'Trust',
    body: 'Public trust pages and transparent pricing make evaluation straightforward for buyers who verify.',
  },
  {
    title: 'Webhook/export actions for operational handoff',
    tag: 'Action layer',
    body: 'Move outputs into your operating system via webhooks and exports—without exposing secrets client-side.',
  },
]

export function CapabilityProofGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {ITEMS.map((x) => (
        <Card key={x.title} className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{x.title}</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                {x.tag}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{x.body}</CardContent>
        </Card>
      ))}
    </div>
  )
}

