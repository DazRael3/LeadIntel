import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function PersonaTemplate(props: {
  personaLabel: string
  headline: string
  subhead: string
  workflowSteps: { title: string; detail: string }[]
  templates: { title: string; body: string; tag?: string }[]
}) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">{props.headline}</CardTitle>
            <Badge variant="outline">{props.personaLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{props.subhead}</p>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Workflow in 3 steps</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          {props.workflowSteps.slice(0, 3).map((s) => (
            <div key={s.title} className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="font-medium text-foreground">{s.title}</div>
              <div className="mt-2">{s.detail}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Copy/paste templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.templates.map((t) => (
            <div key={t.title} className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-foreground">{t.title}</div>
                {t.tag ? <Badge variant="outline">{t.tag}</Badge> : null}
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild className="neon-border hover:glow-effect">
          <Link href="/#try-sample">Try a sample digest</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing#plan-closer">See pricing</Link>
        </Button>
      </div>
    </div>
  )
}

