import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, X } from 'lucide-react'

function truncateText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export function HandoffPreviewDrawer(props: {
  open: boolean
  title: string
  subtitle: string
  payload: Record<string, unknown> | null
  canDeliver: boolean
  delivering: boolean
  onClose: () => void
  onDeliver: () => void
}) {
  if (!props.open) return null

  const pretty = props.payload ? JSON.stringify(props.payload, null, 2) : ''
  const preview = truncateText(pretty, 2400)

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl p-4">
        <Card className="h-full border-cyan-500/20 bg-background/95 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{props.title}</CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">{props.subtitle}</div>
              </div>
              <Button size="sm" variant="outline" onClick={props.onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Preview</Badge>
              <Badge variant="outline">{props.canDeliver ? 'Delivery ready' : 'Setup needed'}</Badge>
            </div>

            <div className="rounded border border-cyan-500/10 bg-card/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Payload (sanitized)</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pretty)
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy JSON
                </Button>
              </div>
              <pre className="mt-2 max-h-[55vh] overflow-auto text-xs text-foreground whitespace-pre-wrap">{preview}</pre>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={props.onClose}>
                Close
              </Button>
              <Button className="neon-border hover:glow-effect" disabled={!props.canDeliver || props.delivering} onClick={props.onDeliver}>
                {props.delivering ? 'Queuing…' : 'Deliver via webhook'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

