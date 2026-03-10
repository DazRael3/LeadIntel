import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DefaultDestinationCard, type DefaultDestinationEndpoint } from '@/components/settings/DefaultDestinationCard'

export function IntegrationConnectionPanel(props: {
  role: 'owner' | 'admin' | 'member'
  endpoints: DefaultDestinationEndpoint[]
  selectedEndpointId: string | null
  saving: boolean
  onSelectDefault: (endpointId: string | null) => void
}) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Connection</CardTitle>
          <Badge variant="outline">Workspace</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DefaultDestinationCard
          role={props.role}
          endpoints={props.endpoints}
          selectedEndpointId={props.selectedEndpointId}
          saving={props.saving}
          onSelect={props.onSelectDefault}
        />
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/settings/integrations/history')}>
            View delivery history
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

