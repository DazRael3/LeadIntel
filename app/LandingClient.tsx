'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BrandHero } from '@/components/BrandHero'
import { OneMinuteDemo } from '@/components/landing/OneMinuteDemo'
import { TrySampleDigest } from '@/components/landing/TrySampleDigest'
import { ProofStrip } from '@/components/marketing/ProofStrip'
import { WorkflowRail } from '@/components/marketing/WorkflowRail'
import { EvidenceCards } from '@/components/marketing/EvidenceCards'
import { TrustFacts } from '@/components/marketing/TrustFacts'
import { SignalCoverage } from '@/components/marketing/SignalCoverage'
import { ProofYouCanInspect } from '@/components/marketing/ProofYouCanInspect'
import { ProofLayer } from '@/components/marketing/ProofLayer'
import { MigrationStories } from '@/components/marketing/MigrationStories'
import { track } from '@/lib/analytics'
import { usePublicAbVariant } from '@/lib/experiments/usePublicAbVariant'

export default function LandingClient() {
  const { variant: headlineVariant } = usePublicAbVariant({
    key: 'landing_headline_ab',
    variants: ['control', 'value_velocity'],
  })
  const { variant: ctaVariant } = usePublicAbVariant({
    key: 'landing_cta_ab',
    variants: ['control', 'book_demo_first'],
  })

  const heroHeadline =
    headlineVariant === 'value_velocity'
      ? 'Get daily high-intent leads and outreach in minutes'
      : 'Turn company signals into qualified leads and ready-to-send outreach'
  const primaryCtaLabel = ctaVariant === 'book_demo_first' ? 'Generate My Leads' : 'Generate My Leads'
  const primaryCtaHref = ctaVariant === 'book_demo_first' ? '/contact' : '/demo'
  const primaryCtaType = ctaVariant === 'book_demo_first' ? 'book_demo' : 'find_my_leads_now'
  const [companyInput, setCompanyInput] = useState('')

  useEffect(() => {
    track('page_view', { path: '/', surface: 'landing' })
    track('landing_view', { path: '/' })
    track('landing_viewed', { path: '/', surface: 'landing' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount
  }, [])

  function submitHeroDemo(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const company = companyInput.trim()
    track('homepage_primary_cta_clicked', { location: 'hero', cta: primaryCtaType, hasCompany: company.length > 0 })
    track('demo_started', { source: 'landing_hero_cta', hasCompany: company.length > 0 })
    const href = company.length > 0 ? `/demo?company=${encodeURIComponent(company)}` : primaryCtaHref
    window.location.href = href
  }

  return (
    <div className="bg-background">
      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="space-y-20 md:space-y-24">
          <section className="pt-2 md:pt-6">
            <div className="grid grid-cols-1 gap-8 items-start">
              <div className="max-w-3xl">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{heroHeadline}</h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                  For SDRs, AEs, and outbound teams who need qualified opportunities fast.
                </p>
                <form className="mt-6 space-y-3" onSubmit={submitHeroDemo}>
                  <Input
                    value={companyInput}
                    onChange={(event) => setCompanyInput(event.target.value)}
                    placeholder="Enter company or domain (e.g. acme.com)"
                    aria-label="Company or domain"
                    className="h-12"
                  />
                  <Button type="submit" size="lg" className="w-full sm:w-auto neon-border hover:glow-effect">
                    {primaryCtaLabel}
                  </Button>
                </form>
                <div className="mt-3 text-xs text-muted-foreground">No signup required.</div>
                <div className="mt-6">
                  <ProofStrip />
                </div>
              </div>
            </div>
          </section>

          <section id="how-it-works" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-12 md:pt-14 border-t border-border/30">
            <OneMinuteDemo />
            <div className="space-y-4">
              <WorkflowRail />
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
            </div>
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
            <div>
              <h2 className="text-2xl font-bold">Secondary: sample digest walkthrough</h2>
              <p className="mt-2 text-muted-foreground max-w-3xl">
                Explore sample output quality, signal coverage, and messaging structure after the core hero and demo walkthrough.
              </p>
            </div>
            <div id="try-sample" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <TrySampleDigest />
              <SignalCoverage />
            </div>
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

