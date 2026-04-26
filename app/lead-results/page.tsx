import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { LeadResultsPageTrack } from '@/components/funnel/LeadResultsPageTrack'
import { cookies } from 'next/headers'
import { DEMO_HANDOFF_COOKIE } from '@/lib/demo/handoff'
import { claimDemoHandoffFromCookieToken } from '@/lib/demo/claim'
import { generateSampleDigest } from '@/lib/sampleDigest'
import { LeadResultsPreviewClient, type PreviewLead } from './LeadResultsPreviewClient'

export const metadata: Metadata = {
  title: 'Lead Results | LeadIntel',
  description: 'Preview lead matches, review AI outreach, and unlock full campaign workflows.',
}

export const dynamic = 'force-dynamic'

function parseSearchParamValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

function buildPreviewLeads(companyRaw: string): PreviewLead[] {
  const company = companyRaw.trim().length > 0 ? companyRaw.trim() : 'acme.com'
  const variants = ['Core', 'Mid-Market', 'Enterprise', 'Expansion', 'Strategic', 'Pipeline']

  return variants.map((variant, index) => {
    const seedInput = index === 0 ? company : `${company} ${variant}`
    const sample = generateSampleDigest(seedInput)
    const topSignals = sample.triggers.slice(0, 2).join(', ')
    return {
      id: `${company}-${variant}`.toLowerCase().replace(/\s+/g, '-'),
      company: index === 0 ? sample.company : `${company} (${variant})`,
      score: sample.score,
      fitReason: `${company} matches this segment because LeadIntel found ${topSignals.toLowerCase()} and a strong timing window for outreach.`,
      whyNow: sample.whyNow,
      outreachSubject: sample.outreach.subject ?? null,
      outreachBody: sample.outreach.body,
      scoreFactors: sample.scoreFactors,
      updatedAtLabel: 'Updated recently',
    }
  })
}

export default async function LeadResultsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const company = parseSearchParamValue(params.company)
  const allPreviewLeads = buildPreviewLeads(company)
  const previewLeads = allPreviewLeads.slice(0, 3)
  const hiddenLeadCount = Math.max(0, allPreviewLeads.length - previewLeads.length)
  const previewCompany = company.trim().length > 0 ? company : 'acme.com'
  let user: { id: string } | null = null
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null

  try {
    supabase = await createClient()
    const auth = await supabase.auth.getUser()
    user = auth.data.user ? { id: auth.data.user.id } : null
  } catch {
    user = null
    supabase = null
  }

  if (!user || !supabase) {
    return (
      <div className="min-h-screen bg-background terminal-grid">
        <LeadResultsPageTrack />
        <div className="container mx-auto px-4 sm:px-6 py-8">
          <LeadResultsPreviewClient company={previewCompany} leads={previewLeads} hiddenLeadCount={hiddenLeadCount} />
        </div>
      </div>
    )
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
            You are signed in. Continue to your saved lead results, outreach drafts, and campaign tracking workflows.
          </p>
        </header>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader>
            <CardTitle>Continue your funnel</CardTitle>
            <CardDescription>
              Move from preview leads to full account-level actions, persistent outreach drafts, and campaign execution.
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
