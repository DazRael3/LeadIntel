import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrustChecklist } from '@/components/marketing/TrustChecklist'
import { BuyerReadiness } from '@/components/marketing/BuyerReadiness'
import { OperationalReadiness } from '@/components/marketing/OperationalReadiness'
import { AuthedSettingsStamp } from '@/components/marketing/AuthedSettingsStamp'

export const metadata: Metadata = {
  title: 'Trust Center | LeadIntel',
  description: 'Security, privacy, policies, and operational transparency.',
  alternates: { canonical: 'https://dazrael.com/trust' },
  openGraph: {
    title: 'Trust Center | LeadIntel',
    description: 'Security, privacy, policies, and operational transparency.',
    url: 'https://dazrael.com/trust',
    images: [
      {
        url: '/api/og?title=Trust%20Center&subtitle=Security%2C%20privacy%2C%20and%20operational%20transparency',
        width: 1200,
        height: 630,
      },
    ],
  },
}

type TrustLink = { href: string; label: string; note?: string }

const LINKS: TrustLink[] = [
  { href: '/security', label: 'Security' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/acceptable-use', label: 'Acceptable Use' },
  { href: '/subprocessors', label: 'Subprocessors' },
  { href: '/dpa', label: 'DPA' },
  { href: '/trust/buyer-readiness', label: 'Buyer readiness', note: 'Controls today, and what we do not claim.' },
  { href: '/status', label: 'Status' },
  { href: '/version', label: 'Version' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/roadmap', label: 'Roadmap' },
] as const

export default function TrustCenterPage() {
  return (
    <MarketingPage title="Trust Center" subtitle="Security, privacy, and operational transparency for buyers who verify.">
      <PageViewTrack event="trust_center_viewed" props={{ page: 'trust' }} />
      <AuthedSettingsStamp payload={{ trust_viewed_at: new Date().toISOString() }} sessionKey="trust_viewed" />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Trust summary</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                Truthful by design
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>LeadIntel stores the minimum needed to run the service.</p>
            <p>Authentication is handled through secure infrastructure.</p>
            <p>Billing is handled by Stripe.</p>
            <p>Workspace data is access-controlled and tenant-isolated.</p>
            <p>Public and authenticated routes are rate-limited.</p>
            <p>Secrets remain server-side.</p>
          </CardContent>
        </Card>

        <TrustChecklist />
        <BuyerReadiness />
        <OperationalReadiness />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LINKS.map((l) => (
            <Card key={l.href} className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{l.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {l.note ? <div className="text-sm text-muted-foreground">{l.note}</div> : null}
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={l.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MarketingPage>
  )
}

