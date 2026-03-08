'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import type { PersonaAngle } from '@/lib/domain/people'
import { Copy } from 'lucide-react'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function PersonaAngleCard(props: { accountId: string; angle: PersonaAngle }) {
  const { toast } = useToast()
  const a = props.angle

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{a.persona}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{a.category.replaceAll('_', ' ')}</Badge>
            <Badge variant="outline">priority {a.priority}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Why-now angle</div>
          <div className="mt-1 text-sm text-foreground">{a.whyNowAngle}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Likely pain</div>
            <div className="mt-1 text-xs text-muted-foreground">{a.likelyPain}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Opening direction</div>
            <div className="mt-1 text-xs text-muted-foreground">{a.openingDirection}</div>
          </div>
        </div>

        {a.whyRecommended.length > 0 ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Why this persona</div>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              {a.whyRecommended.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Suggested first touch</div>
            <Badge variant="outline">{a.suggestedFirstTouch.channel}</Badge>
          </div>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{a.suggestedFirstTouch.text}</pre>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={async () => {
                track('persona_opener_copied', { accountId: props.accountId, persona: a.persona })
                const ok = await copyText(a.suggestedFirstTouch.text)
                toast(ok ? { variant: 'success', title: 'Copied', description: 'Persona opener copied.' } : { variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy opener
            </Button>
          </div>
        </div>

        {a.limitations.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            Limitations: {a.limitations.join(' ')}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

