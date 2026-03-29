import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Item = { title: string; body: string; tag: string }

const ITEMS: Item[] = [
  {
    title: 'Freshness matters (and we show it)',
    tag: 'Freshness',
    body: 'Signal-driven outputs are strongest when supporting events are recent. When signals are stale or missing, LeadIntel surfaces “limited” states instead of guessing.',
  },
  {
    title: 'Coverage is inspectable, not implied',
    tag: 'Coverage',
    body: 'Account and report views summarize source coverage and limitations (signals, first-party matches when available, and explainability completeness).',
  },
  {
    title: 'Operational actions are logged',
    tag: 'Auditability',
    body: 'Workspace-governed actions like exports, webhooks, templates, briefs, and key generations are recorded as metadata-first audit events (no sensitive bodies).',
  },
  {
    title: 'Integrations are honest and destination-based',
    tag: 'Handoffs',
    body: 'LeadIntel prepares CRM and sequencer-ready handoff packages and delivers them via workspace-configured webhooks/exports. Delivery history is sanitized and inspectable.',
  },
]

export function OperationalReadiness() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Operational transparency</CardTitle>
          <Badge variant="outline" className="li-chip">
            Inspectable
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ITEMS.map((i) => (
          <div key={i.title} className="rounded border border-cyan-500/10 bg-background/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{i.tag}</div>
            <div className="mt-2 text-sm font-medium text-foreground">{i.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{i.body}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

