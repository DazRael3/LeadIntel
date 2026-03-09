'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Row = {
  playbookSlug: string
  playbookTitle: string
  evidence: string
  workspaceDeliverRate: { low: number; high: number } | null
  crossWorkspaceTypicalRange: { low: number; high: number } | null
  confidence: string
}

function isRow(x: unknown): x is Row {
  return Boolean(x && typeof x === 'object' && 'playbookSlug' in x && 'playbookTitle' in x)
}

function fmt(r: { low: number; high: number } | null): string {
  if (!r) return '—'
  return `${Math.round(r.low * 100)}–${Math.round(r.high * 100)}%`
}

function evidenceBadge(e: string): { text: string; variant: 'default' | 'secondary' | 'outline' } {
  if (e === 'cross_workspace_anonymous') return { text: 'Cross-workspace', variant: 'default' }
  if (e === 'workspace_only') return { text: 'Workspace', variant: 'secondary' }
  return { text: 'Limited', variant: 'outline' }
}

export function PlaybookBenchmarkTable(props: { rows: unknown[] }) {
  const rows = (props.rows ?? []).filter(isRow)
  if (rows.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Playbook benchmarking (bounded)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">Playbook</th>
              <th className="py-2 text-left font-medium">Evidence</th>
              <th className="py-2 text-left font-medium">Your completion</th>
              <th className="py-2 text-left font-medium">Typical range</th>
              <th className="py-2 text-left font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const eb = evidenceBadge(r.evidence)
              return (
                <tr key={r.playbookSlug} className="border-b border-border/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{r.playbookTitle}</div>
                    <div className="text-xs text-muted-foreground">{r.playbookSlug}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={eb.variant}>{eb.text}</Badge>
                  </td>
                  <td className="py-2 pr-3">{fmt(r.workspaceDeliverRate)}</td>
                  <td className="py-2 pr-3">{fmt(r.crossWorkspaceTypicalRange)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{r.confidence}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

