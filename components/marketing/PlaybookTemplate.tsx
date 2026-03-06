import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getTemplateBySlug } from '@/lib/templates/registry'

export function PlaybookTemplate(props: {
  title: string
  subtitle: string
  promise: string
  whenWorksBest: string[]
  timingSignals: string[]
  angles: { title: string; detail: string }[]
  sequencePack: { day: string; label: string; templateSlug: string }[]
  objections: { objection: string; response: string }[]
  personalizationExamples: { label: string; example: string }[]
  related: { href: string; label: string }[]
}) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>{props.subtitle}</div>
          <div>{props.promise}</div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">When this play works best</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            {props.whenWorksBest.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Signals that make timing strong</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            {props.timingSignals.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Angle library</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          {props.angles.map((a) => (
            <div key={a.title} className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="font-medium text-foreground">{a.title}</div>
              <div className="mt-2">{a.detail}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sequence pack (7 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {props.sequencePack.map((s) => {
            const tpl = getTemplateBySlug(s.templateSlug)
            const href = `/templates/${s.templateSlug}`
            return (
              <div key={`${s.day}-${s.templateSlug}`} className="rounded border border-cyan-500/20 bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{s.day}</Badge>
                    <div className="font-medium text-foreground">{s.label}</div>
                  </div>
                  <Link className="text-cyan-400 hover:underline text-sm" href={href}>
                    Open template
                  </Link>
                </div>
                {tpl ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs text-muted-foreground">{tpl.title}</div>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {tpl.subject ? `Subject: ${tpl.subject}\n\n${tpl.body}` : tpl.body}
                    </pre>
                  </div>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Objection handling</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          {props.objections.map((o) => (
            <div key={o.objection} className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="font-medium text-foreground">{o.objection}</div>
              <div className="mt-2">{o.response}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Personalization examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {props.personalizationExamples.map((e) => (
            <div key={e.label} className="rounded border border-cyan-500/20 bg-background/50 p-4">
              <div className="text-xs font-medium text-foreground">{e.label}</div>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{e.example}</pre>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Generate a tailored pitch in LeadIntel</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <div>Use your ICP + watchlist to generate “why now” outreach you can send fast.</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="neon-border hover:glow-effect">
              <Link href="/#try-sample">Try a sample digest</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
              How scoring works
            </Link>
            {props.related.map((r) => (
              <Link key={r.href} className="text-cyan-400 hover:underline" href={r.href}>
                {r.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
