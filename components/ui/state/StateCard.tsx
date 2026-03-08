import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type StateTone = 'neutral' | 'info' | 'warning' | 'danger'

export type StateAction = {
  label: string
  href: string
  variant?: 'default' | 'outline'
}

export function StateCard(props: {
  title: string
  body: string
  tone?: StateTone
  badge?: string
  primaryAction?: StateAction
  secondaryAction?: StateAction
}) {
  const tone = props.tone ?? 'neutral'
  const border =
    tone === 'danger'
      ? 'border-red-500/20'
      : tone === 'warning'
        ? 'border-yellow-500/20'
        : tone === 'info'
          ? 'border-cyan-500/20'
          : 'border-cyan-500/20'

  return (
    <Card className={`${border} bg-card/60`}>
      <CardContent className="py-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-foreground">{props.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{props.body}</div>
          </div>
          {props.badge ? <Badge variant="outline">{props.badge}</Badge> : null}
        </div>

        {(props.primaryAction || props.secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3">
            {props.primaryAction ? (
              <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect" variant={props.primaryAction.variant ?? 'default'}>
                <Link href={props.primaryAction.href}>{props.primaryAction.label}</Link>
              </Button>
            ) : null}
            {props.secondaryAction ? (
              <Button asChild size="sm" className="w-full sm:w-auto" variant={props.secondaryAction.variant ?? 'outline'}>
                <Link href={props.secondaryAction.href}>{props.secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

