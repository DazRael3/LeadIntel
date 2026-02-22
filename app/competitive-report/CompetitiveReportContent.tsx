import React from 'react'
import Link from 'next/link'
import { TopNav } from '@/components/TopNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandHero } from '@/components/BrandHero'
import { getDisplayPlanMeta, type PlanTier } from '@/lib/billing/plan'
import type { LatestPitchSummary } from '@/lib/services/pitchesLatest'

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
  const planMeta = getDisplayPlanMeta(tier ? { tier } : null)
  const planLabel = planMeta.tier === 'starter' ? 'Starter (limited)' : 'Closer'

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
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

          {isLoggedIn && (
            <div className="mt-10 rounded-2xl border border-cyan-500/10 bg-card/50 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold">Your latest LeadIntel report</h2>
                <span className="inline-flex items-center rounded-full border border-cyan-500/20 bg-background/30 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
                  {planLabel}
                </span>
              </div>

              {!latestPitch ? (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">You haven’t generated a competitive report yet.</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                      <Link href="/dashboard">Go to dashboard to generate your first report</Link>
                    </Button>
                    {planMeta.tier === 'starter' && (
                      <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                        <Link href="/pricing">View pricing &amp; plans</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                (() => {
                  const href = latestPitch.deepLinkHref
                  const bullets = latestPitch.previewBullets ?? []
                  return (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-semibold text-foreground">
                          {latestPitch.companyName || 'Latest report'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Generated: {latestPitch.createdAt.toLocaleString()}
                        </div>
                      </div>

                      {bullets.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {bullets.map((b, idx) => (
                            <li key={idx}>{b}</li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                          <Link href={href}>Open this report in your dashboard</Link>
                        </Button>

                        {planMeta.tier === 'starter' ? (
                          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                            <Link href="/pricing">View pricing &amp; plans</Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                            <Link href="/dashboard/history">Go to full pitch history</Link>
                          </Button>
                        )}
                      </div>

                      {planMeta.tier === 'starter' && (
                        <p className="text-xs text-muted-foreground">
                          You’re on the Starter plan — this is a limited sample. Upgrade to Closer to unlock full history and more
                          signals.
                        </p>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-cyan-500/10 bg-card/50 p-6">
            <h2 className="text-xl font-bold">What’s inside each LeadIntel report</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Executive summary of the competitive landscape for your chosen company or segment.</li>
              <li>3–5 key moves from competitors (funding, launches, hiring, partnerships, press).</li>
              <li>Account-ready email copy you can paste into your outbound sequences.</li>
              <li>Battlecard talking points for discovery calls and stakeholder meetings.</li>
              <li>Links back into LeadIntel so you can drill into signals, watchlists, and live trigger events.</li>
            </ul>

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

