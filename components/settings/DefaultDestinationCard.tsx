import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type DefaultDestinationEndpoint = {
  id: string
  url: string
  is_enabled: boolean
}

function truncateUrl(url: string): string {
  const u = url.trim()
  if (u.length <= 52) return u
  return u.slice(0, 24) + '…' + u.slice(-20)
}

export function DefaultDestinationCard(props: {
  role: 'owner' | 'admin' | 'member'
  endpoints: DefaultDestinationEndpoint[]
  selectedEndpointId: string | null
  saving: boolean
  onSelect: (endpointId: string | null) => void
}) {
  const isAdmin = props.role === 'owner' || props.role === 'admin'
  const selected = props.endpoints.find((e) => e.id === props.selectedEndpointId) ?? null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Default handoff destination</CardTitle>
          <Badge variant="outline">Webhooks</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">
          Used for one-click delivery of CRM and Sequencer handoffs. The endpoint must be enabled and subscribed to handoff events.
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Selected</div>
          <div className="mt-1 text-sm text-foreground">{selected ? truncateUrl(selected.url) : 'Not set'}</div>
          {!selected ? <div className="mt-1 text-xs text-muted-foreground">Prepare actions will still work, but delivery will require setup.</div> : null}
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={props.saving}
              onClick={() => props.onSelect(null)}
              data-testid="handoff-default-clear"
            >
              Clear default
            </Button>
            {props.endpoints.filter((e) => e.is_enabled).slice(0, 6).map((e) => (
              <Button
                key={e.id}
                size="sm"
                variant={props.selectedEndpointId === e.id ? 'default' : 'outline'}
                disabled={props.saving}
                onClick={() => props.onSelect(e.id)}
                data-testid={`handoff-default-${e.id}`}
              >
                {truncateUrl(e.url)}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Ask a workspace admin to set a default destination.</div>
        )}
      </CardContent>
    </Card>
  )
}

