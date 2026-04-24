import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CampaignPageTrack } from '@/components/funnel/CampaignPageTrack'
import { CampaignPageClient } from './CampaignPageClient'

export const metadata: Metadata = {
  title: 'Campaign | LeadIntel',
  description: 'Launch and manage outbound campaigns from qualified leads.',
}

export const dynamic = 'force-dynamic'

export default async function CampaignPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/campaign')
  }

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <CampaignPageTrack />
        <header>
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Campaign Builder</h1>
          <p className="mt-2 text-muted-foreground">
            Build campaigns from high-fit leads, sequence outreach, and move execution into Actions.
          </p>
        </header>

        <CampaignPageClient />

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Campaign workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Select qualified leads from your lead results.</li>
              <li>Generate and review outreach messaging.</li>
              <li>Route approved tasks into Actions and delivery channels.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="neon-border hover:glow-effect">
                <Link href="/dashboard/actions">Open Actions queue</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/lead-results">Back to lead results</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
