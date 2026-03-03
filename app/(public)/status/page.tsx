import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Status | LeadIntel',
  description: 'Service status and basic health checks for LeadIntel.',
  openGraph: {
    title: 'Status | LeadIntel',
    description: 'Service status and basic health checks for LeadIntel.',
    url: 'https://dazrael.com/status',
  },
}

type HealthEnvelope =
  | { ok: true; data: { ok: boolean; checks?: Record<string, unknown> } }
  | { ok: false; error?: { message?: string } }

type VersionEnvelope =
  | { ok: true; data: { appEnv?: string; nodeEnv?: string; branch?: string; commitSha?: string } }
  | { ok: false; error?: { message?: string } }

export default async function StatusPage() {
  const baseUrl = getBaseUrl()

  const [health, version] = await Promise.all([
    safeFetchJson<HealthEnvelope>(`${baseUrl}/api/health`),
    safeFetchJson<VersionEnvelope>(`${baseUrl}/api/version`),
  ])

  const isOperational = health?.ok === true && Boolean(health.data?.ok)

  return (
    <MarketingPage title="Status" subtitle="Operational signals for the LeadIntel service.">
      <PageViewTrack event="status_page_view" props={{ page: 'status' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Current status</CardTitle>
              <Badge variant="outline" className={isOperational ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'}>
                {isOperational ? 'All systems operational' : 'Degraded / unknown'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div>
              <span className="font-medium text-foreground">Health endpoint:</span>{' '}
              <Link className="text-cyan-400 hover:underline" href="/api/health">
                /api/health
              </Link>
            </div>
            <div>
              <span className="font-medium text-foreground">Version endpoint:</span>{' '}
              <Link className="text-cyan-400 hover:underline" href="/api/version">
                /api/version
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Health checks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {health ? (
                <>
                  <div>
                    <span className="font-medium text-foreground">OK:</span> {String(health.ok === true && Boolean((health as any).data?.ok))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This is a lightweight check designed not to expose secrets.
                  </div>
                </>
              ) : (
                <div>Unable to load health checks.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Deploy info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {version && version.ok === true ? (
                <>
                  <div>
                    <span className="font-medium text-foreground">Branch:</span> {version.data?.branch ?? 'unknown'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Commit:</span> {version.data?.commitSha ?? 'unknown'}
                  </div>
                </>
              ) : (
                <div>Unable to load version info.</div>
              )}
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href="/api/version">View raw version</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/support">Contact support</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/security">Security overview</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

function getBaseUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

