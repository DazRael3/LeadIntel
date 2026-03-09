import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RefinementFinding } from '@/lib/refinement/audit'
import { REFINEMENT_GAP_CATEGORIES } from '@/lib/refinement/gap-categories'

function statusVariant(status: 'ok' | 'warn' | 'needs_attention'): 'outline' | 'secondary' | 'destructive' {
  if (status === 'ok') return 'outline'
  if (status === 'warn') return 'secondary'
  return 'destructive'
}

function categoryLabel(key: string): string {
  return REFINEMENT_GAP_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

export function PolishGapTable(props: { findings: RefinementFinding[] }) {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Polish gaps</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                <th className="text-left py-2 pr-3">Category</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Finding</th>
                <th className="text-left py-2">Next steps</th>
              </tr>
            </thead>
            <tbody>
              {props.findings.map((f, idx) => (
                <tr key={`${f.category}-${idx}`} className="border-b border-cyan-500/10 align-top">
                  <td className="py-2 pr-3 font-medium text-foreground">{categoryLabel(f.category)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="text-foreground font-medium">{f.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{f.detail}</div>
                    {f.evidence && f.evidence.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {f.evidence.map((e) => (
                          <Badge key={`${e.key}-${e.value}`} variant="outline" className="text-[11px] text-muted-foreground">
                            {e.key}: <span className="text-foreground">{e.value}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <ul className="list-disc pl-5 space-y-1 text-xs">
                      {f.suggestedNextSteps.slice(0, 3).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

