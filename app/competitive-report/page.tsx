import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNav } from '@/components/TopNav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandHero } from '@/components/BrandHero'

export const metadata: Metadata = {
  title: 'Competitive Intelligence Report | LeadIntel',
  description:
    'Learn how LeadIntel turns near real-time buying signals into AI-generated pitches, battlecards, and watchlists to help you create pipeline faster.',
}

export default function CompetitiveReportPage() {
  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
      <main className="container mx-auto px-6 py-16">
        <section className="mx-auto max-w-4xl">
          <header className="text-center">
            <h1 className="text-4xl font-bold bloomberg-font neon-cyan">Competitive Intelligence Report</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              LeadIntel helps B2B teams spot buying intent, prioritize accounts, and generate conversion-ready outreach in minutes.
            </p>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Signals</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Near real-time buying signals and trigger events you can act on today.
              </CardContent>
            </Card>
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Pitches</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                AI-generated competitive pitches and battlecards tailored to each account.
              </CardContent>
            </Card>
            <Card className="border-cyan-500/10 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Markets</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Market watchlists with live stock and crypto data to anchor outreach in reality.
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 rounded-2xl border border-cyan-500/10 bg-card/50 p-6">
            <h2 className="text-xl font-bold">What you get</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Near real-time buying signals and trigger events</li>
              <li>AI-generated competitive pitches and battlecards</li>
              <li>Market watchlists with live stock and crypto data</li>
            </ul>
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg" className="neon-border hover:glow-effect">
                <Link href="/signup">Sign up to try LeadIntel</Link>
              </Button>
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

