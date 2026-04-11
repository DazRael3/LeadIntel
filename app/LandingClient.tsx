'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BrandHero } from '@/components/BrandHero'
import { OneMinuteDemo } from '@/components/landing/OneMinuteDemo'
import { TrySampleDigest } from '@/components/landing/TrySampleDigest'
import { ProofStrip } from '@/components/marketing/ProofStrip'
import { WorkflowRail } from '@/components/marketing/WorkflowRail'
import { EvidenceCards } from '@/components/marketing/EvidenceCards'
import { TrustFacts } from '@/components/marketing/TrustFacts'
import { WhySwitchCards } from '@/components/marketing/WhySwitchCards'
import { SignalCoverage } from '@/components/marketing/SignalCoverage'
import { ProofYouCanInspect } from '@/components/marketing/ProofYouCanInspect'
import { ProofLayer } from '@/components/marketing/ProofLayer'
import { MigrationStories } from '@/components/marketing/MigrationStories'
import { track } from '@/lib/analytics'
import { COPY } from '@/lib/copy/leadintel'

export default function LandingClient() {
  useEffect(() => {
    track('landing_view', { path: '/' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])

  return (
    <div className="bg-background">
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="space-y-20 md:space-y-24">
          <section className="pt-2 md:pt-6">
            <div className="grid grid-cols-1 gap-8 items-start">
              <div className="max-w-4xl">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{COPY.home.hero.headline}</h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{COPY.home.hero.subhead}</p>
                <p className="mt-3 text-sm text-muted-foreground max-w-3xl">{COPY.home.hero.support}</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Button asChild size="lg" className="neon-border hover:glow-effect">
                    <Link
                      href="#try-sample"
                      onClick={() => track('homepage_primary_cta_clicked', { location: 'hero', cta: 'sample_digest' })}
                    >
                      {COPY.home.hero.primaryCta}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link
                      href="/pricing"
                      onClick={() => track('homepage_secondary_cta_clicked', { location: 'hero', cta: 'pricing' })}
                    >
                      {COPY.home.hero.secondaryCta}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link
                      href="/contact"
                      onClick={() => track('homepage_secondary_cta_clicked', { location: 'hero', cta: 'book_demo' })}
                    >
                      Book a demo
                    </Link>
                  </Button>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{COPY.home.hero.microTrust}</div>

                <div className="mt-8">
                  <ProofStrip />
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-12 md:pt-14 border-t border-border/30">
            <OneMinuteDemo />
            <div className="space-y-4">
              <div id="try-sample" className="scroll-mt-24">
                <TrySampleDigest />
              </div>
              <Card className="border-cyan-500/10 bg-card/50">
                <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">New here?</div>
                    <div className="mt-1 text-xs text-muted-foreground">Take a 2-minute tour of the workflow.</div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="neon-border hover:glow-effect"
                    onClick={() => track('homepage_secondary_cta_clicked', { location: 'try_sample', cta: 'tour' })}
                  >
                    <Link href="/tour">Take the tour</Link>
                  </Button>
                </CardContent>
              </Card>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="outline">
                  <Link href="/use-cases">Explore use cases</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/trust">Trust Center</Link>
                </Button>
              </div>
              <SignalCoverage />
            </div>
          </section>

          <section className="scroll-mt-24 space-y-6 pt-12 md:pt-14 border-t border-border/30">
            <div>
              <h2 className="text-2xl font-bold">Why teams switch to LeadIntel</h2>
            </div>
            <WhySwitchCards />
          </section>

          <section id="how-it-works" className="scroll-mt-24 pt-12 md:pt-14 border-t border-border/30">
            <WorkflowRail />
          </section>

          <section className="scroll-mt-24 space-y-6 pt-12 md:pt-14 border-t border-border/30">
            <div>
              <h2 className="text-2xl font-bold">Evidence, not hype</h2>
              <p className="mt-2 text-muted-foreground max-w-3xl">
                LeadIntel is built around inspectable mechanics: deterministic scoring, a public sample flow, an action layer, and public trust pages.
              </p>
            </div>
            <EvidenceCards />
            <TrustFacts />
          </section>

          <section className="scroll-mt-24 space-y-6 pt-12 md:pt-14 border-t border-border/30">
            <ProofLayer />
          </section>

          <section className="scroll-mt-24 space-y-6 pt-12 md:pt-14 border-t border-border/30">
            <MigrationStories />
          </section>

          <section className="scroll-mt-24 pt-12 md:pt-14 border-t border-border/30">
            <ProofYouCanInspect />
          </section>

          <div className="max-w-4xl mx-auto pt-10 md:pt-12 border-t border-border/30">
            <BrandHero />
          </div>
        </div>
      </main>
    </div>
  )
}

