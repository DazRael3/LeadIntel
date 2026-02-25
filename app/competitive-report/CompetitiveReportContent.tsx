import React from 'react'
import Link from 'next/link'
import { TopNav } from '@/components/TopNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandHero } from '@/components/BrandHero'
import { getDisplayPlanMeta, type PlanTier } from '@/lib/billing/plan'
import type { LatestPitchSummary } from '@/lib/services/pitchesLatest'
import { CompetitiveReportViewTracker, TrackedButtonLink } from './CompetitiveReportTracking'

function LatestReportCard({
  tier,
  latestPitch,
}: {
  tier: PlanTier | null
  latestPitch: LatestPitchSummary | null
}) {
  const planMeta = getDisplayPlanMeta(tier ? { tier } : null)
  const isStarter = planMeta.tier === 'starter'
  const badgeText = isStarter ? 'Starter (Limited)' : 'Closer (Full access)'
  const tierValue = isStarter ? 'starter' : 'closer'

  if (!latestPitch) {
    return (
      <Card className="mt-6 border-cyan-500/20 bg-background/30" data-testid="latest-report-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your latest LeadIntel report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isStarter
              ? 'No report generated yet. Start in the LeadIntel dashboard.'
              : 'No report yet. Generate your first competitive report in the LeadIntel dashboard.'}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <TrackedButtonLink
              href="/reports"
              label="View all reports"
              eventName="competitive_report_view_all_reports"
              eventProps={{ tier: tierValue }}
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
            />
            {isStarter && (
              <TrackedButtonLink
                href="/pricing"
                label="View pricing & plans"
                eventName="competitive_report_click_pricing"
                eventProps={{ tier: tierValue }}
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
              />
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const executiveSummary = latestPitch.previewBullets?.[0]?.trim() || 'A concise competitive brief, generated from live signals.'
  const keyInsights = (latestPitch.previewBullets ?? []).slice(1).filter(Boolean)

  return (
    <Card className="mt-6 border-cyan-500/20 bg-background/30" data-testid="latest-report-card">
      <CardHeader className="pb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your latest LeadIntel report
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{latestPitch.companyName}</CardTitle>
            <div className="text-xs text-muted-foreground">Generated on {latestPitch.createdAt.toLocaleString()}</div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-cyan-500/20 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
            {badgeText}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-cyan-500/10 bg-card/40 p-4">
              <div
                className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90"
                data-testid="latest-report-executive-label"
              >
                Executive summary
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{executiveSummary}</p>
            </div>

            {isStarter ? (
              <div
                data-testid="report-teaser-masked"
                className="relative overflow-hidden rounded-xl border border-cyan-500/10 bg-card/30"
              >
                <div className="space-y-4 p-4 blur-[2px] opacity-70">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">Full analysis</div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                      Competitive positioning, buying signals, and a tighter angle for outreach—generated from the full LeadIntel engine.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-cyan-500/10 bg-background/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">Trigger events</div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        Funding, launches, hiring spikes, partnerships, press…
                      </p>
                    </div>
                    <div className="rounded-lg border border-cyan-500/10 bg-background/30 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">Email copy</div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        Account-ready sequences and talking points, ready to paste into outreach.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/70" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Locked sections in this report
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li>Full competitive breakdown for this account</li>
                      <li>Source-level trigger event details</li>
                      <li>Extra outreach templates and channels</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-cyan-500/10 bg-card/30 p-4">
                <div
                  className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90"
                  data-testid="latest-report-insights-label"
                >
                  Key insights
                </div>
                {keyInsights.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {keyInsights.map((x, idx) => (
                      <li key={idx}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open the full report in the dashboard to view the complete competitive brief, trigger events, and email copy.
                  </p>
                )}
              </div>
            )}

            {!isStarter && (
              <div className="rounded-xl border border-cyan-500/10 bg-card/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">Next steps</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this report to tailor your next email, call, or sequence. Your full pitch and trigger events are available in
                  the dashboard.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-1">
            <TrackedButtonLink
              href={latestPitch.deepLinkHref}
              label={isStarter ? 'Open limited report in dashboard' : 'Open full report in dashboard'}
              eventName="competitive_report_open_dashboard"
              eventProps={{ tier: tierValue, companyName: latestPitch.companyName, reportId: latestPitch.id }}
              size="sm"
              className="w-full neon-border hover:glow-effect"
            />

            <TrackedButtonLink
              href="/reports"
              label="View all reports"
              eventName="competitive_report_view_all_reports"
              eventProps={{ tier: tierValue }}
              size="sm"
              variant="outline"
              className="w-full"
            />

            {isStarter ? (
              <TrackedButtonLink
                href="/pricing"
                label="View pricing & plans"
                eventName="competitive_report_click_pricing"
                eventProps={{ tier: tierValue }}
                size="sm"
                variant="outline"
                className="w-full"
              />
            ) : (
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href="/dashboard/history">View all pitches</Link>
              </Button>
            )}

            {isStarter && (
              <div className="pt-2 text-xs text-muted-foreground">
                You’re on the Starter plan. Upgrade to unlock full competitive analysis, trigger events, and account-ready email copy.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CompetitiveReportContent({
  viewer,
  tier,
  latestPitch,
}: {
  viewer: { id: string } | null
  tier: PlanTier | null
  latestPitch: LatestPitchSummary | null
}) {
  const isLoggedIn = Boolean(viewer)

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
      <CompetitiveReportViewTracker isLoggedIn={isLoggedIn} tier={(tier as 'starter' | 'closer' | null) ?? null} />
      <main className="container mx-auto px-6 py-16">
        <section className="mx-auto max-w-4xl">
          <header className="text-center">
            <h1 className="text-4xl font-bold bloomberg-font neon-cyan">Competitive Intelligence Report</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              LeadIntel turns noisy buying intent, market news, and product launches into a concise brief your team can use in the
              very next campaign or call.
            </p>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Signals</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Near real-time buying signals, funding rounds, product launches, and other trigger events for your target accounts.
              </CardContent>
            </Card>
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Pitches</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                AI-generated competitive pitches and battlecards that highlight why prospects should choose you over key rivals.
              </CardContent>
            </Card>
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Markets</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Watchlists with live stock and crypto data so your outreach is anchored in current market reality.
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 rounded-2xl border border-cyan-500/10 bg-card/50 p-6">
            <h2 className="text-xl font-bold">What’s inside each LeadIntel report</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Executive summary of the competitive landscape for your chosen company or segment.</li>
              <li>3–5 key moves from competitors (funding, launches, hiring, partnerships, press).</li>
              <li>Account-ready email copy you can paste into your outbound sequences.</li>
              <li>Battlecard talking points for discovery calls and stakeholder meetings.</li>
              <li>Links back into LeadIntel so you can drill into signals, watchlists, and live trigger events.</li>
            </ul>

            {isLoggedIn && <LatestReportCard tier={tier} latestPitch={latestPitch} />}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                <Link href="/signup">Sign up to try LeadIntel</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link href="/pricing">View pricing &amp; plans</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-500/10 bg-card/50 p-6">
            <h2 className="text-xl font-bold">How it works</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="border-cyan-500/10 bg-background/30">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-cyan-300">1</div>
                  Tell us who you care about – pick a company, URL, or segment.
                </CardContent>
              </Card>
              <Card className="border-cyan-500/10 bg-background/30">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-cyan-300">2</div>
                  We scan signals &amp; markets – open web, curated feeds, and market data.
                </CardContent>
              </Card>
              <Card className="border-cyan-500/10 bg-background/30">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-cyan-300">3</div>
                  You get a competitive brief in your LeadIntel dashboard, ready to use in outreach.
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-12">
            <BrandHero />
          </div>
        </section>
      </main>
    </div>
  )
}

