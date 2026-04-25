'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Copy, Lock, TrendingUp } from 'lucide-react'
import { track } from '@/lib/analytics'

export type PreviewLead = {
  id: string
  company: string
  score: number
  fitReason: string
  whyNow: string
  outreachSubject: string | null
  outreachBody: string
}

type LeadResultsPreviewClientProps = {
  company: string
  leads: PreviewLead[]
}

const FREE_PREVIEW_LIMIT = 3

export function LeadResultsPreviewClient({ company, leads }: LeadResultsPreviewClientProps) {
  const router = useRouter()
  const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [copiedShareLink, setCopiedShareLink] = useState(false)
  const visibleLeads = useMemo(() => leads.slice(0, FREE_PREVIEW_LIMIT), [leads])
  const hiddenLeadCount = Math.max(0, leads.length - FREE_PREVIEW_LIMIT)

  const signupRedirect = useMemo(() => {
    const redirect = `/lead-results?company=${encodeURIComponent(company)}`
    return `/signup?redirect=${encodeURIComponent(redirect)}`
  }, [company])

  async function copyOutreach(lead: PreviewLead): Promise<void> {
    const message = [
      lead.outreachSubject ? `Subject: ${lead.outreachSubject}` : null,
      lead.outreachBody,
      '',
      'Generated with RaelInfo',
      'https://raelinfo.com',
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(message)
      setCopiedLeadId(lead.id)
      setTimeout(() => setCopiedLeadId((curr) => (curr === lead.id ? null : curr)), 2000)
      track('demo_preview_outreach_copied', { source: 'lead_results_preview', leadId: lead.id })
    } catch {
      setCopiedLeadId(null)
    }
  }

  async function copyShareLink(): Promise<void> {
    const link = `${window.location.origin}/lead-results?company=${encodeURIComponent(company)}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedShareLink(true)
      setTimeout(() => setCopiedShareLink(false), 1600)
      track('lead_results_share_link_copied', { source: 'lead_results_preview', companyLen: company.length })
    } catch {
      setCopiedShareLink(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
            Leads refresh daily
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            Limited preview
          </Badge>
        </div>
        <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Lead Results</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Preview your best-fit leads for <span className="text-foreground font-medium">{company}</span>. You can copy AI outreach now, then unlock full lead tracking and campaign execution.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void copyShareLink()}>
            {copiedShareLink ? 'Share link copied' : 'Copy share link'}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/demo">
              Try RaelInfo demo
            </Link>
          </Button>
        </div>
      </header>

      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step progress</CardTitle>
          <CardDescription>From search to outreach to campaign execution.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-cyan-200">Step 1</div>
            <div className="mt-1 font-medium text-foreground">Find leads</div>
            <div className="text-xs text-muted-foreground">Completed in demo search</div>
          </div>
          <div className="rounded border border-cyan-500/25 bg-cyan-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-cyan-200">Step 2</div>
            <div className="mt-1 font-medium text-foreground">Review matches + outreach</div>
            <div className="text-xs text-muted-foreground">Previewing top {FREE_PREVIEW_LIMIT} leads</div>
          </div>
          <div className="rounded border border-border bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Step 3</div>
            <div className="mt-1 font-medium text-foreground">Unlock full workflow</div>
            <div className="text-xs text-muted-foreground">Save leads, campaigns, and tracking</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {visibleLeads.map((lead, index) => (
          <Card key={lead.id} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{lead.company}</CardTitle>
                  <CardDescription className="mt-1">
                    Lead score <span className="text-foreground font-medium">{lead.score}/100</span> · Preview lead {index + 1} of {FREE_PREVIEW_LIMIT}
                  </CardDescription>
                </div>
                <Badge className="bg-cyan-500/10 text-cyan-200 border-cyan-500/20">High-fit preview</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Why this lead is a good fit</div>
                <p className="mt-2 text-sm text-foreground">{lead.fitReason}</p>
                <p className="mt-2 text-xs text-muted-foreground">{lead.whyNow}</p>
              </div>

              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">AI-generated outreach message</div>
                {lead.outreachSubject ? (
                  <div className="mt-2 text-sm text-foreground">
                    <span className="font-medium">Subject:</span> {lead.outreachSubject}
                  </div>
                ) : null}
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{lead.outreachBody}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyOutreach(lead)}
                  className="neon-border hover:glow-effect"
                >
                  {copiedLeadId === lead.id ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    track('demo_preview_add_to_campaign_clicked', { source: 'lead_results_preview', leadId: lead.id })
                    router.push(signupRedirect)
                  }}
                  className="neon-border hover:glow-effect"
                >
                  Add to Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hiddenLeadCount > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-300" />
                  {hiddenLeadCount} more leads are locked in limited preview
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade to unlock full lead lists, AI outreach at scale, and campaign tracking.
                </p>
              </div>
              <Button
                type="button"
                className="neon-border hover:glow-effect"
                onClick={() => {
                  setShowUpgradeModal(true)
                  track('demo_preview_paywall_opened', { source: 'lead_results_preview', hiddenLeadCount })
                }}
              >
                View Upgrade Options
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Share this preview</CardTitle>
          <CardDescription>Share a public lead preview and invite others to try the workflow.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            Share this page to showcase lead quality and outreach drafts.
          </div>
          <div className="text-xs">CTA included: Try tool at /demo</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyShareLink()}>
              {copiedShareLink ? 'Copied' : 'Copy public preview link'}
            </Button>
            <Button asChild size="sm" className="neon-border hover:glow-effect">
              <Link href="/demo">Try tool</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {showUpgradeModal ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl border-cyan-500/30 bg-card">
            <CardHeader>
              <CardTitle className="text-xl">Limited preview reached</CardTitle>
              <CardDescription>Unlock the full conversion workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-foreground">
                Get full outcomes, not just samples:
                <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
                  <li>More qualified leads beyond the limited preview</li>
                  <li>AI outreach drafts you can reuse and iterate quickly</li>
                  <li>Campaign tracking to monitor execution and follow-up</li>
                </ul>
              </div>
              <div className="text-xs text-muted-foreground">Leads refresh daily. Preview access remains limited until you upgrade.</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild className="neon-border hover:glow-effect">
                  <Link href="/pricing?target=closer">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade for full access
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={signupRedirect}>Create account</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/login?mode=signin&redirect=${encodeURIComponent(`/lead-results?company=${encodeURIComponent(company)}`)}`}>
                    I already have an account
                  </Link>
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={() => setShowUpgradeModal(false)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
