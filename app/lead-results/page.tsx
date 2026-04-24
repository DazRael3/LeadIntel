import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { LeadResultsPageTrack } from '@/components/funnel/LeadResultsPageTrack'
import { cookies } from 'next/headers'
import { DEMO_HANDOFF_COOKIE } from '@/lib/demo/handoff'
import { claimDemoHandoffFromCookieToken } from '@/lib/demo/claim'

export const metadata: Metadata = {
  title: 'Lead Results | LeadIntel',
  description: 'Review generated lead results and move into dashboard workflows.',
}

export const dynamic = 'force-dynamic'

export default async function LeadResultsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?mode=signin&redirect=/lead-results')
  }

  // Safety-net claim for direct login flows that bypass the email callback route.
  try {
    const cookieStore = await cookies()
    const handoffToken = cookieStore.get(DEMO_HANDOFF_COOKIE)?.value ?? null
    if (handoffToken) {
      await claimDemoHandoffFromCookieToken({
        token: handoffToken,
        userId: user.id,
        supabase,
      })
    }
  } catch {
    // Never block lead-results render on best-effort handoff claim.
  }

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <LeadResultsPageTrack />
      <div className="container mx-auto px-4 sm:px-6 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Lead Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You are signed in. Continue to your saved lead results in the dashboard.
          </p>
        </header>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader>
            <CardTitle>Continue your funnel</CardTitle>
            <CardDescription>
              Move from generated sample leads to full account-level actions, drafts, and campaign execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="neon-border hover:glow-effect">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/campaign">Go to campaign</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
