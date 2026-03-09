import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceIntegrationSummary } from '@/lib/integrations/types'
import { capabilitySummary } from '@/lib/integrations/capabilities'

function toneForState(state: WorkspaceIntegrationSummary['integrations'][number]['status']['state']): {
  label: string
  className: string
} {
  if (state === 'ready') return { label: 'Ready', className: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' }
  if (state === 'configured') return { label: 'Configured', className: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' }
  if (state === 'limited') return { label: 'Limited', className: 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' }
  if (state === 'error') return { label: 'Error', className: 'border-red-500/30 text-red-200 bg-red-500/10' }
  return { label: 'Not connected', className: 'border-muted-foreground/20 text-muted-foreground bg-muted/20' }
}

export function IntegrationStatusCard(props: {
  integration: WorkspaceIntegrationSummary['integrations'][number]
}) {
  const st = props.integration.status
  const tone = toneForState(st.state)
  const caps = capabilitySummary(props.integration)

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{props.integration.name}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">{props.integration.shortDescription}</div>
          </div>
          <Badge variant="outline" className={tone.className}>
            {tone.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {caps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {caps.map((c) => (
              <Badge key={c} variant="outline" className="border-cyan-500/10">
                {c}
              </Badge>
            ))}
          </div>
        ) : null}
        {st.blockingReason ? <div className="text-xs text-muted-foreground">{st.blockingReason}</div> : null}
        {st.detail ? <div className="text-xs text-muted-foreground">{st.detail}</div> : null}
        <div className="text-xs text-muted-foreground">{props.integration.setupHint}</div>
      </CardContent>
    </Card>
  )
}

