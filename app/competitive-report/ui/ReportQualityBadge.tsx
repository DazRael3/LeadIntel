"use client"

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { computeReportQuality } from '@/lib/reports/quality'

function gradeLabel(grade: ReturnType<typeof computeReportQuality>['grade']): string {
  if (grade === 'excellent') return 'Excellent'
  if (grade === 'good') return 'Good'
  if (grade === 'needs_attention') return 'Needs attention'
  return 'Framework only'
}

function gradeVariant(grade: ReturnType<typeof computeReportQuality>['grade']): 'outline' | 'secondary' | 'destructive' {
  if (grade === 'excellent') return 'outline'
  if (grade === 'good') return 'secondary'
  if (grade === 'needs_attention') return 'destructive'
  return 'secondary'
}

export function ReportQualityBadge(props: { reportMarkdown: string; sourcesUsed: unknown | null; sourcesFetchedAt: string | null }) {
  const q = useMemo(
    () =>
      computeReportQuality({
        reportMarkdown: props.reportMarkdown,
        sourcesUsed: props.sourcesUsed,
        sourcesFetchedAt: props.sourcesFetchedAt,
      }),
    [props.reportMarkdown, props.sourcesUsed, props.sourcesFetchedAt]
  )

  return (
    <Card className="border-cyan-500/10 bg-background/30">
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={gradeVariant(q.grade)} className="text-sm">
            Quality: {q.score} · {gradeLabel(q.grade)}
          </Badge>
          <Badge variant="outline">Citations: {q.citations}</Badge>
          <Badge variant="outline">Hypotheses: {q.hypotheses}</Badge>
          {q.lastRefreshedLabel ? <Badge variant="outline">Last refreshed: {q.lastRefreshedLabel}</Badge> : null}
        </div>

        <details className="rounded border border-cyan-500/10 bg-card/30 px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">Explain score</summary>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <div>Citations: +{q.breakdown.citationsPoints}/60</div>
            <div>Freshness: +{q.breakdown.freshnessPoints}/25</div>
            <div>Hypotheses: −{q.breakdown.hypothesesPenalty}/15</div>
            <div className="pt-1 text-foreground">Final: {q.score}/100</div>
            {q.breakdown.reasons.length > 0 ? (
              <ul className="list-disc pl-5">
                {q.breakdown.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>

        {q.grade === 'framework_only' ? (
          <div className="text-xs text-muted-foreground">
            Framework-based report (no live citations). Use the verification checklist to confirm facts.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

