import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type StepId = 'icp' | 'accounts' | 'shortlist' | 'score' | 'pitch' | 'saved'

export function TourPreview(props: { stepId: StepId }) {
  if (props.stepId === 'icp') return <IcpPreview />
  if (props.stepId === 'accounts') return <AccountsPreview />
  if (props.stepId === 'shortlist') return <ShortlistPreview />
  if (props.stepId === 'score') return <ScorePreview />
  if (props.stepId === 'pitch') return <PitchPreview />
  return <SavedPreview />
}

function IcpPreview() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">ICP</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        <Field label="What you sell" value="B2B sales enablement platform" />
        <Field label="Ideal customer" value="Outbound SDRs/AEs selling to mid-market / enterprise SaaS" />
        <div className="text-xs text-muted-foreground">
          LeadIntel uses your ICP to prioritize the right accounts and draft tighter outreach.
        </div>
      </CardContent>
    </Card>
  )
}

function AccountsPreview() {
  const accounts = [
    { name: 'Northwind Systems', domain: 'northwind.example', tag: 'SaaS' },
    { name: 'Horizon Data', domain: 'horizon.example', tag: 'Data' },
    { name: 'Acme Platform', domain: 'acme.example', tag: 'Platform' },
    { name: 'Orbit Security', domain: 'orbit.example', tag: 'Security' },
  ]
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Target accounts</CardTitle>
          <Badge variant="outline">{accounts.length} tracked</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((a) => (
          <div key={a.domain} className="flex items-center justify-between gap-3 rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-foreground">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.domain}</div>
            </div>
            <Badge variant="outline">{a.tag}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ShortlistPreview() {
  const items = [
    { company: 'Northwind Systems', score: 87, trigger: 'Hiring spike in RevOps' },
    { company: 'Orbit Security', score: 78, trigger: 'Product launch + new messaging' },
    { company: 'Horizon Data', score: 73, trigger: 'Partnership announcement' },
  ]
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Daily shortlist</CardTitle>
          <Badge variant="outline">Today</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((x) => (
          <div key={x.company} className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{x.company}</div>
              <Badge variant="outline">Score {x.score}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{x.trigger}</div>
          </div>
        ))}
        <div className="text-xs text-muted-foreground">
          The goal is a short list you can act on, not a feed you ignore.
        </div>
      </CardContent>
    </Card>
  )
}

function ScorePreview() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Score + momentum, explained</CardTitle>
          <Badge variant="outline">0–100</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-foreground">Northwind Systems</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">87</Badge>
              <Badge variant="outline">Rising (+11 / 7d)</Badge>
            </div>
          </div>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Hiring spike in RevOps suggests process standardization.</li>
            <li>Multiple roles imply scale-up and tooling evaluation.</li>
            <li>Trigger recency is high (last 7 days).</li>
          </ul>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">First-party intent</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-foreground">Active research</div>
              <Badge variant="outline">fresh</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Shown when domain-matched visitor activity exists.</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">People recommendations</div>
            <div className="mt-1 text-sm text-muted-foreground">Champion: Director RevOps · Buyer: VP Sales</div>
            <div className="mt-1 text-xs text-muted-foreground">Persona-level recommendations tied to signals (not named contact data).</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Deterministic score with reasons. No black box.</div>
      </CardContent>
    </Card>
  )
}

function PitchPreview() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Pitch draft</CardTitle>
          <Badge variant="outline">Email</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/10 bg-background/40 p-4">
{`Subject: Quick question on the RevOps hiring push

Saw the RevOps hiring spike at Northwind Systems — quick question: is the focus right now standardizing pipeline reporting, or enablement/ramp?

If you’re tackling standardization, I can share a short checklist for turning “why now” triggers into a daily shortlist + a send-ready draft for reps.

Worth 10 minutes this week?`}
        </pre>
        <div className="text-xs text-muted-foreground">Generated from your ICP + the account’s current “why now”.</div>
      </CardContent>
    </Card>
  )
}

function SavedPreview() {
  const saved = [
    { label: 'Saved account brief', detail: 'Compact brief you can regenerate and reuse' },
    { label: 'Persona opener directions', detail: 'Champion / buyer openers tied to why-now signals' },
    { label: 'Export / webhook handoff', detail: 'Operator-safe summary routed into your system' },
  ]
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Saved outputs</CardTitle>
          <Badge variant="outline">{saved.length} items</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {saved.map((s) => (
          <div key={s.label} className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
            <div className="text-sm font-medium text-foreground">{s.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.detail}</div>
          </div>
        ))}
        <div className="text-xs text-muted-foreground">Save briefs, drafts, and angles so you don’t start from scratch.</div>
      </CardContent>
    </Card>
  )
}

function Field(props: { label: string; value: string }) {
  return (
    <div className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{props.value}</div>
    </div>
  )
}

