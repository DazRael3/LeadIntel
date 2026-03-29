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
    title: 'Momentum over time (not a single static score)',
    tag: 'Momentum',
    body: 'Accounts rise, cool, or stay steady based on recent signals. LeadIntel makes movement visible so reps act while timing is fresh.',
  },
  {
    title: 'First-party intent when it exists (clearly labeled)',
    tag: 'First-party',
    body: 'When visitor or first-party signals match an account, LeadIntel shows freshness and an intent label. When it doesn’t, the UI says so.',
  },
  {
    title: 'People + buying-group recommendations (persona-level)',
    tag: 'People',
    body: 'Who to contact is presented as heuristic persona recommendations tied to observed signals—without inventing named contacts.',
  },
  {
    title: 'Action packaging (copy → variants → brief → handoff)',
    tag: 'Action layer',
    body: 'Move from why-now signals to operator-safe outputs: copyable summaries/openers, outreach variants, saved briefs, and webhook/export delivery.',
  },
  {
    title: 'Shared team workflow (approvals + audit visibility)',
    tag: 'Team',
    body: 'Standardize templates with approval gates and audit visibility so execution stays consistent across reps.',
  },
  {
    title: 'Inspectable trust and pricing before sales contact',
    tag: 'Trust',
    body: 'Public trust pages and transparent pricing make evaluation straightforward for buyers who verify.',
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
              <Badge variant="outline" className="li-chip">
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

