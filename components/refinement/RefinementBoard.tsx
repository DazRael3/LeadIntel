import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RefinementAuditReport } from '@/lib/refinement/audit'
import { PolishGapTable } from '@/components/refinement/PolishGapTable'

export function RefinementBoard(props: { report: RefinementAuditReport }) {
  const { report } = props
  return (
    <div className="space-y-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Refinement audit</CardTitle>
              <div className="text-xs text-muted-foreground">Generated {new Date(report.generatedAt).toLocaleString()}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">OK: {report.summary.ok}</Badge>
              <Badge variant="secondary">Warn: {report.summary.warn}</Badge>
              <Badge variant="destructive">Needs attention: {report.summary.needsAttention}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This board is grounded in real registries and product surfaces. It’s designed to drive small, high-impact patches—not a rewrite.
        </CardContent>
      </Card>

      <PolishGapTable findings={report.findings} />
    </div>
  )
}

