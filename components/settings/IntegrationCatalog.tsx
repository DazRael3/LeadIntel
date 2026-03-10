import type { WorkspaceIntegrationSummary } from '@/lib/integrations/types'
import { IntegrationStatusCard } from '@/components/settings/IntegrationStatusCard'

export function IntegrationCatalog(props: { summary: WorkspaceIntegrationSummary }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="integration-catalog">
      {props.summary.integrations.map((i) => (
        <IntegrationStatusCard key={i.id} integration={i} />
      ))}
    </div>
  )
}

