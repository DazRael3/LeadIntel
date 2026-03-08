'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { Copy, Download, ExternalLink, Send } from 'lucide-react'

type DemoSignalType = 'hiring' | 'product' | 'partnership' | 'press' | 'web_intent'

type DemoSignal = {
  id: string
  type: DemoSignalType
  title: string
  summary: string
  occurredAtIso: string
  sourceUrl?: string
  confidence?: number
}

type DemoAccount = {
  id: string
  name: string
  domain: string
  score: number
  scoreDelta7d: number
  whyNow: string
  topSignals: DemoSignal[]
  opener: { channel: 'email' | 'linkedin_dm' | 'call'; subject?: string; body: string }
}

function formatMomentum(delta: number): { label: 'rising' | 'steady' | 'cooling'; color: string } {
  if (delta >= 6) return { label: 'rising', color: 'text-emerald-300' }
  if (delta <= -6) return { label: 'cooling', color: 'text-amber-300' }
  return { label: 'steady', color: 'text-slate-200' }
}

function isoToNice(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
}

function safeDomainLink(domain: string): string {
  const d = domain.trim().toLowerCase()
  return `https://${encodeURIComponent(d)}`
}

export function InteractiveWorkspaceDemo() {
  const { toast } = useToast()
  const interacted = useRef(false)

  const accounts: DemoAccount[] = useMemo(() => {
    // Simulated data: for an in-browser walkthrough only (not pulled from the live product DB).
    // This is intentionally conservative and does not claim real-world events.
    const baseDate = new Date()
    const d = (daysAgo: number) => new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    return [
      {
        id: 'acct_1',
        name: 'Northwind Systems',
        domain: 'northwind.example',
        score: 87,
        scoreDelta7d: 11,
        whyNow: 'Multiple operational signals suggest active evaluation. The goal is to contact while timing is fresh—before a vendor is chosen.',
        topSignals: [
          {
            id: 'sig_1',
            type: 'hiring',
            title: 'Hiring spike: RevOps / enablement roles',
            summary: 'Hiring patterns can indicate scale-up and process standardization needs.',
            occurredAtIso: d(2),
            confidence: 0.78,
          },
          {
            id: 'sig_2',
            type: 'product',
            title: 'Messaging update / product packaging changes',
            summary: 'Changes in positioning often align with pipeline/enablement initiatives.',
            occurredAtIso: d(4),
            confidence: 0.64,
          },
        ],
        opener: {
          channel: 'email',
          subject: 'Quick question on the RevOps push',
          body:
            `Saw the recent RevOps hiring push at {{company}} — quick question: is the focus standardizing pipeline reporting, or enablement/ramp?\n\nIf you're tackling standardization, I can share a short checklist for turning "why now" signals into a daily shortlist + send-ready outreach.\n\nWorth 10 minutes this week?`,
        },
      },
      {
        id: 'acct_2',
        name: 'Orbit Security',
        domain: 'orbit.example',
        score: 78,
        scoreDelta7d: 3,
        whyNow: 'A small cluster of signals suggests active motion, but urgency is moderate. Prioritize after the highest-momentum accounts.',
        topSignals: [
          {
            id: 'sig_3',
            type: 'press',
            title: 'Press mention / coverage',
            summary: 'External mentions can create windows for relevant outreach angles.',
            occurredAtIso: d(5),
            confidence: 0.57,
          },
        ],
        opener: {
          channel: 'linkedin_dm',
          body:
            `Saw the recent momentum around {{company}} — curious if your team is prioritizing pipeline creation or improving conversion right now.\n\nIf helpful, I can share a lightweight "why now" workflow we use to shortlist accounts daily and draft first touches quickly.`,
        },
      },
      {
        id: 'acct_3',
        name: 'Horizon Data',
        domain: 'horizon.example',
        score: 73,
        scoreDelta7d: -7,
        whyNow: 'Signals are cooling. Keep on the watchlist, but shift outreach time toward rising accounts.',
        topSignals: [
          {
            id: 'sig_4',
            type: 'partnership',
            title: 'Partnership announcement',
            summary: 'Partnerships can shift priorities; timing depends on execution phase.',
            occurredAtIso: d(10),
            confidence: 0.52,
          },
        ],
        opener: {
          channel: 'call',
          body:
            `Hi {{name}} — I’m calling because we help outbound teams turn timing signals into a daily shortlist and a send-ready first touch.\n\nQuick question: how are you deciding which accounts deserve outreach *this week*?`,
        },
      },
    ]
  }, [])

  const [activeAccountId, setActiveAccountId] = useState<string>(accounts[0]?.id ?? '')
  const active = useMemo(() => accounts.find((a) => a.id === activeAccountId) ?? accounts[0]!, [accounts, activeAccountId])
  const momentum = useMemo(() => formatMomentum(active.scoreDelta7d), [active.scoreDelta7d])

  const markInteracted = useCallback(() => {
    if (interacted.current) return
    interacted.current = true
    track('tour_workspace_interacted', { surface: 'interactive_demo' })
  }, [])

  const copyText = useCallback(
    async (text: string, kind: string) => {
      markInteracted()
      try {
        await navigator.clipboard.writeText(text)
        toast({ variant: 'success', title: 'Copied', description: 'Copied to clipboard.' })
        track('tour_workspace_copy', { kind })
      } catch {
        toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' })
      }
    },
    [markInteracted, toast]
  )

  const fakeExport = useCallback(() => {
    markInteracted()
    const csv =
      'account_id,company,domain,score,score_delta_7d,momentum,top_signals,opener\n' +
      `${active.id},"${active.name}","${active.domain}",${active.score},${active.scoreDelta7d},${momentum.label},"${active.topSignals
        .map((s) => s.title.replaceAll('"', '""'))
        .join(' | ')}","${active.opener.body.replaceAll('"', '""')}"\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leadintel-demo-${active.domain}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ variant: 'success', title: 'Exported', description: 'Downloaded a 1-account CSV.' })
    track('tour_workspace_export_clicked', { kind: 'single_account_csv' })
  }, [active, markInteracted, momentum.label, toast])

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Interactive workspace preview</CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              A simulated walk-through of the workflow: target accounts → daily shortlist → score explanation → why-now → send-ready action.
            </div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            Simulated demo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-lg border border-cyan-500/10 bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target accounts</div>
              <Badge variant="outline">{accounts.length} tracked</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {accounts.map((a) => {
                const isActive = a.id === activeAccountId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      markInteracted()
                      setActiveAccountId(a.id)
                    }}
                    className={
                      'w-full rounded-md border px-3 py-2 text-left transition-colors ' +
                      (isActive ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-cyan-500/10 hover:bg-cyan-500/5')
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground">{a.name}</div>
                      <Badge variant="outline">Score {a.score}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{a.domain}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily shortlist</div>
            <div className="mt-2 space-y-2">
              {accounts
                .slice()
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((a) => (
                  <div key={a.id} className="rounded border border-cyan-500/10 bg-black/20 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-foreground">{a.name}</div>
                      <Badge variant="outline">{a.score}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{a.topSignals[0]?.title ?? 'Signal detected'}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue="score" className="space-y-3">
            <TabsList className="bg-background/50 border border-cyan-500/20">
              <TabsTrigger value="score" onClick={markInteracted}>
                Score explanation
              </TabsTrigger>
              <TabsTrigger value="signals" onClick={markInteracted}>
                Signal timeline
              </TabsTrigger>
              <TabsTrigger value="draft" onClick={markInteracted}>
                Outreach draft
              </TabsTrigger>
              <TabsTrigger value="action" onClick={markInteracted}>
                Action center
              </TabsTrigger>
            </TabsList>

            <TabsContent value="score">
              <div className="rounded-xl border border-cyan-500/10 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{active.name}</div>
                    <div className="text-xs text-muted-foreground">{active.domain}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Score {active.score}/100</Badge>
                    <Badge variant="outline" className={momentum.color}>
                      {momentum.label} ({active.scoreDelta7d >= 0 ? '+' : ''}
                      {active.scoreDelta7d})
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why now</div>
                  <div className="mt-1">{active.whyNow}</div>
                </div>
                <div className="mt-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top reasons</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {active.topSignals.map((s) => (
                      <li key={s.id}>
                        {s.title}{' '}
                        <span className="text-xs text-muted-foreground">
                          ({s.confidence != null ? `confidence ${(s.confidence * 100).toFixed(0)}%` : 'confidence n/a'})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signals">
              <div className="rounded-xl border border-cyan-500/10 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">Signals (simulated)</div>
                  <Badge variant="outline">Freshness matters</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {active.topSignals.map((s) => (
                    <div key={s.id} className="rounded-lg border border-cyan-500/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-foreground">{s.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{isoToNice(s.occurredAtIso)}</span>
                          {s.sourceUrl ? (
                            <a className="text-cyan-400 hover:underline inline-flex items-center gap-1" href={s.sourceUrl} target="_blank" rel="noreferrer">
                              source <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="draft">
              <div className="rounded-xl border border-cyan-500/10 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">Send-ready outreach</div>
                  <Badge variant="outline">{active.opener.channel}</Badge>
                </div>
                {active.opener.subject ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Subject:</span> {active.opener.subject}
                  </div>
                ) : null}
                <pre className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/10 bg-black/20 p-4">
                  {active.opener.body}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copyText(active.opener.body, 'opener')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy opener
                  </Button>
                  {active.opener.subject ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void copyText(`Subject: ${active.opener.subject}\n\n${active.opener.body}`, 'email_with_subject')
                      }
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy subject + body
                    </Button>
                  ) : null}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="action">
              <div className="rounded-xl border border-cyan-500/10 bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">Action center</div>
                  <Badge variant="outline">Workflow fit</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  In LeadIntel, actions route into your operating system (webhooks/exports). In this demo, actions run locally to show the flow.
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => void copyText(active.whyNow, 'why_now_summary')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy why-now
                  </Button>
                  <Button variant="outline" size="sm" onClick={fakeExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export 1-account CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      markInteracted()
                      toast({ variant: 'success', title: 'Queued', description: 'Simulated webhook push queued.' })
                      track('tour_workspace_webhook_clicked', { event: 'account.pushed' })
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Push to webhook
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}

