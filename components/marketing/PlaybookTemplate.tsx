import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type TemplateBlock = { label: string; body: string }

export function PlaybookTemplate(props: {
  title: string
  promise: string
  problemWhyNow: string[]
  lookFor: string[]
  angles: { title: string; detail: string }[]
  templates: {
    cold1: TemplateBlock
    cold2: TemplateBlock
    cold3: TemplateBlock
    dm1: TemplateBlock
    dm2: TemplateBlock
    call1: TemplateBlock
    call2: TemplateBlock
  }
  tokens: { token: string; how: string }[]
  related: { href: string; label: string }[]
}) {
  const t = props.templates
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{props.promise}</CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Problem → why now</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {props.problemWhyNow.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">What to look for</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            {props.lookFor.map((x) => (
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
          <CardTitle className="text-lg">Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <TemplateBlockView {...t.cold1} />
          <TemplateBlockView {...t.cold2} />
          <TemplateBlockView {...t.cold3} />
          <TemplateBlockView {...t.dm1} />
          <TemplateBlockView {...t.dm2} />
          <TemplateBlockView {...t.call1} />
          <TemplateBlockView {...t.call2} />
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Personalization tokens</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Token</th>
                  <th className="text-left py-2">How to fill</th>
                </tr>
              </thead>
              <tbody>
                {props.tokens.map((x) => (
                  <tr key={x.token} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{x.token}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{x.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function TemplateBlockView(props: TemplateBlock) {
  return (
    <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
      <div className="text-xs font-medium text-foreground">{props.label}</div>
      <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{props.body}</pre>
    </div>
  )
}

