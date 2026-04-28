import type { Metadata } from 'next'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getPublicVersionInfo } from '@/lib/debug/buildInfo'

export const metadata: Metadata = {
  title: 'Version | LeadIntel',
  description: 'Public, non-sensitive build and version information.',
  alternates: { canonical: 'https://raelinfo.com/version' },
  openGraph: {
    title: 'Version | LeadIntel',
    description: 'Public, non-sensitive build and version information.',
    url: 'https://raelinfo.com/version',
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
  const version = getPublicVersionInfo()

  return (
    <MarketingPage title="Version" subtitle="Public, non-sensitive build information.">
      <PageViewTrack event="version_page_viewed" props={{ page: 'version' }} />

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Release</CardTitle>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              {version.nodeEnv ?? 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">App env</dt>
              <dd className="mt-1 text-foreground">{version.appEnv ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Commit</dt>
              <dd className="mt-1 text-foreground">{version.commitShort ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Deploy env</dt>
              <dd className="mt-1 text-foreground">{version.deployEnv ?? 'unknown'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Generated at</dt>
              <dd className="mt-1 text-foreground">{version.generatedAt ?? 'unknown'}</dd>
            </div>
          </dl>
          <details className="mt-5 rounded border border-cyan-500/10 bg-background/40 p-4">
            <summary className="cursor-pointer text-sm text-foreground">Implementation details</summary>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Repo</dt>
                <dd className="mt-1 text-foreground">{version.repo ?? 'unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Branch</dt>
                <dd className="mt-1 text-foreground">{version.branch ?? 'unknown'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Full commit SHA</dt>
                <dd className="mt-1 break-all text-foreground">{version.commitSha ?? 'unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Deployment URL</dt>
                <dd className="mt-1 text-foreground">{version.deploymentUrl ?? 'unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Build time</dt>
                <dd className="mt-1 text-foreground">{version.buildTime ?? 'unknown'}</dd>
              </div>
            </dl>
          </details>
        </CardContent>
      </Card>
    </MarketingPage>
  )
}

