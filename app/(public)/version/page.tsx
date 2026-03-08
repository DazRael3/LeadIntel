import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getBuildInfo } from '@/lib/debug/buildInfo'

export const metadata: Metadata = {
  title: 'Version | LeadIntel',
  description: 'Public, non-sensitive build and version information.',
  alternates: { canonical: 'https://dazrael.com/version' },
  openGraph: {
    title: 'Version | LeadIntel',
    description: 'Public, non-sensitive build and version information.',
    url: 'https://dazrael.com/version',
    images: [
      {
        url: '/api/og?title=Version&subtitle=Public%20build%20information',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function VersionPage() {
  const build = getBuildInfo()
  const repo = build.repoOwner && build.repoSlug ? `${build.repoOwner}/${build.repoSlug}` : null

  return (
    <MarketingPage title="Version" subtitle="Public, non-sensitive build information.">
      <PageViewTrack event="trust_center_viewed" props={{ page: 'version' }} />

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Build</CardTitle>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              {process.env.NODE_ENV ?? 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">App env</dt>
              <dd className="mt-1 text-foreground">{process.env.NEXT_PUBLIC_APP_ENV ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Repo</dt>
              <dd className="mt-1 text-foreground">{repo ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Branch</dt>
              <dd className="mt-1 text-foreground">{build.branch ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commit SHA</dt>
              <dd className="mt-1 text-foreground">{build.commitSha ?? 'unknown'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </MarketingPage>
  )
}

