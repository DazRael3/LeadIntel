import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'

export const metadata: Metadata = {
  title: 'Buyer readiness | LeadIntel',
  description: 'Truthful controls and questions larger buyers usually ask.',
  alternates: { canonical: 'https://raelinfo.com/trust/buyer-readiness' },
  openGraph: {
    title: 'Buyer readiness | LeadIntel',
    description: 'Truthful controls and questions larger buyers usually ask.',
    url: 'https://raelinfo.com/trust/buyer-readiness',
    images: [
      {
        url: '/api/og?title=Buyer%20readiness&subtitle=Controls%20today%20(no%20overclaims)',
        width: 1200,
        height: 630,
      },
    ],
  },
}

type DocLink = { href: string; label: string; note?: string }

const TRUST_DOCS: DocLink[] = [
  { href: '/security', label: 'Security' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/subprocessors', label: 'Subprocessors' },
  { href: '/dpa', label: 'DPA' },
  { href: '/terms', label: 'Terms' },
  { href: '/acceptable-use', label: 'Acceptable Use' },
  { href: '/status', label: 'Status' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/version', label: 'Version' },
  { href: '/roadmap', label: 'Roadmap (directional)' },
] as const

const CHECKLIST: Array<{ q: string; a: string }> = [
  {
    q: 'How is workspace access controlled?',
    a: 'Workspaces are tenant-isolated and enforced by database row-level policies plus membership checks. Roles determine which privileged actions are allowed.',
  },
  {
    q: 'How are changes audited?',
    a: 'Key team-governed actions (members/invites, templates, webhooks, exports, workflow actions) record audit entries without logging secrets or full request bodies.',
  },
  {
    q: 'What identity features exist today?',
    a: 'Authentication uses Supabase email/password sessions. LeadIntel does not claim SSO/SAML/SCIM unless explicitly implemented and enabled.',
  },
  {
    q: 'What governance controls can admins configure?',
    a: 'Workspace admins can set invite domain restrictions, restrict exports by role, and (optionally) require approval before certain handoff deliveries.',
  },
  {
    q: 'How can data leave the system?',
    a: 'LeadIntel supports operational delivery through exports and webhook-based handoff. Payloads are structured and do not expose secrets or tokens.',
  },
  {
    q: 'What does LeadIntel not claim?',
    a: 'No SOC 2 / ISO 27001 claims, no SSO/SAML/SCIM claims, and no “enterprise guarantees” beyond what’s implemented and inspectable in product.',
  },
]

export default function BuyerReadinessPage() {
  const mailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel Buyer review')

  return (
    <MarketingPage title="Buyer readiness" subtitle="Controls and verification surfaces for buyers who evaluate seriously.">
      <PageViewTrack event="buyer_readiness_page_viewed" props={{ page: 'buyer_readiness' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">What’s here</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                No fake compliance packages
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              This page is intentionally plain: it points to the real trust docs and explains what LeadIntel controls today,
              without overclaiming SSO or certifications.
            </p>
            <p>
              For larger deployments with additional review requirements, contact{' '}
              <a className="text-cyan-400 hover:underline" href={mailto}>
                {SUPPORT_EMAIL}
              </a>{' '}
              to align on rollout needs and current scope.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Trust docs</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TRUST_DOCS.map((d) => (
              <Button key={d.href} asChild variant="outline" className="justify-between">
                <Link href={d.href}>
                  <span>{d.label}</span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Vendor review checklist (questions buyers usually ask)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            {CHECKLIST.map((x) => (
              <div key={x.q} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-foreground font-medium">{x.q}</div>
                <div className="mt-1 text-xs text-muted-foreground">{x.a}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/trust">Back to Trust Center</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Pricing</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

