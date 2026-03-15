import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { StatusAutoRefresh } from './status-auto-refresh'

export const metadata: Metadata = {
  title: 'Status | LeadIntel',
  description: 'Service status and basic health checks for LeadIntel.',
  alternates: { canonical: 'https://dazrael.com/status' },
  openGraph: {
    title: 'Status | LeadIntel',
    description: 'Service status and basic health checks for LeadIntel.',
    url: 'https://dazrael.com/status',
    images: [
      {
        url: '/api/og?title=Status&subtitle=Lightweight%20health%20checks%20(without%20secrets)',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export const revalidate = 0

type HealthEnvelope =
  | {
      ok: true
      data: {
        status: 'operational' | 'degraded' | 'down'
        checkedAt: string
        components: Record<
          string,
          {
            status: 'ok' | 'degraded' | 'down' | 'not_enabled' | 'not_checked'
            message: string
          }
        >
      }
    }
  | { ok: false; error?: { message?: string } }

type VersionEnvelope =
  | { ok: true; data: { appEnv?: string; nodeEnv?: string; branch?: string; commitSha?: string } }
  | { ok: false; error?: { message?: string } }

type AutomationEnvelope =
  | {
      ok: true
      data: {
        enabled: boolean
        lastRuns: Record<string, { status: string; finishedAt: string }>
      }
    }
  | { ok: false; error?: { message?: string } }

type OpsHealthEnvelope =
  | {
      ok: true
      data: {
        score: number
        grade: 'excellent' | 'good' | 'needs_attention' | 'critical'
        updatedAt: string
      }
    }
  | { ok: false; error?: { message?: string } }

export default async function StatusPage() {
  const baseUrl = await getBaseUrl()

  const [health, version, automation, opsHealth] = await Promise.all([
    safeFetchJson<HealthEnvelope>(`${baseUrl}/api/health`),
    safeFetchJson<VersionEnvelope>(`${baseUrl}/api/version`),
    safeFetchJson<AutomationEnvelope>(`${baseUrl}/api/public/automation`),
    safeFetchJson<OpsHealthEnvelope>(`${baseUrl}/api/public/ops-health`),
  ])

  const status = health?.ok === true ? health.data.status : 'degraded'
  const checkedAt = health?.ok === true ? health.data.checkedAt : null
  const branch = version?.ok === true ? (version.data?.branch ?? null) : null
  const commitSha = version?.ok === true ? (version.data?.commitSha ?? null) : null
  const commitShort = commitSha ? commitSha.slice(0, 8) : null

  const badge =
    status === 'operational'
      ? { label: 'Operational', cls: 'text-green-400 border-green-500/30' }
      : status === 'down'
        ? { label: 'Outage', cls: 'text-red-400 border-red-500/30' }
        : { label: 'Degraded', cls: 'text-yellow-400 border-yellow-500/30' }

  return (
    <MarketingPage title="Status" subtitle="Operational signals for the LeadIntel service.">
      <PageViewTrack event="status_page_viewed" props={{ page: 'status' }} />
      <StatusAutoRefresh />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Current status</CardTitle>
              <Badge variant="outline" className={badge.cls}>
                {badge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <div className="text-xs text-muted-foreground">
              This page shows lightweight checks designed not to expose secrets.
            </div>
            <div>
              <span className="font-medium text-foreground">Status:</span> {status}
            </div>
            {opsHealth?.ok === true ? (
              <div>
                <span className="font-medium text-foreground">Ops health:</span> {opsHealth.data.score}/100{' '}
                <span className="text-xs text-muted-foreground">({opsHealth.data.grade})</span>
              </div>
            ) : null}
            {checkedAt ? (
              <div>
                <span className="font-medium text-foreground">Last checked:</span> {new Date(checkedAt).toLocaleString()}
              </div>
            ) : null}
            <div>
              <span className="font-medium text-foreground">Version:</span>{' '}
              <Link className="text-cyan-400 hover:underline" href="/version">
                /version
              </Link>{' '}
            </div>
            <details className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <summary className="cursor-pointer text-xs text-foreground">Technical endpoints (debug)</summary>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div>
                  <Link className="text-cyan-400 hover:underline" href="/api/health">
                    /api/health
                  </Link>
                </div>
                <div>
                  <Link className="text-cyan-400 hover:underline" href="/api/version">
                    /api/version
                  </Link>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Components</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {health?.ok === true ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-3">Component</th>
                        <th className="text-left py-2 pr-3">Status</th>
                        <th className="text-left py-2">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(health.data.components).map(([name, c]) => (
                        <tr key={name} className="border-b border-cyan-500/10">
                          <td className="py-2 pr-3 font-medium text-foreground">{name}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={
                                c.status === 'ok'
                                  ? 'text-green-400'
                                  : c.status === 'down'
                                    ? 'text-red-400'
                                    : c.status === 'not_enabled'
                                      ? 'text-muted-foreground'
                                      : c.status === 'not_checked'
                                        ? 'text-muted-foreground'
                                        : 'text-yellow-400'
                              }
                            >
                              {c.status === 'not_enabled'
                                ? 'Not enabled'
                                : c.status === 'not_checked'
                                  ? 'Not checked'
                                  : c.status}
                            </span>
                          </td>
                          <td className="py-2">{c.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>Unable to load components.</div>
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
                    <span className="font-medium text-foreground">Branch:</span> {branch ?? 'unknown'}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Commit:</span> {commitShort ?? 'unknown'}
                  </div>
                </>
              ) : (
                <div>Unable to load version info.</div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/version">View version</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/api/version">View raw version</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Automation</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            {automation?.ok === true && automation.data.enabled ? (
              Object.keys(automation.data.lastRuns).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-3">Job</th>
                        <th className="text-left py-2 pr-3">Status</th>
                        <th className="text-left py-2">Finished</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(automation.data.lastRuns).map(([job, run]) => (
                        <tr key={job} className="border-b border-cyan-500/10">
                          <td className="py-2 pr-3 font-medium text-foreground">
                            <div>{job}</div>
                            {job === 'content_audit' ? (
                              <div className="mt-1 text-xs font-normal text-muted-foreground">Content audit details are available inside the app.</div>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge variant="outline">{run.status}</Badge>
                          </td>
                          <td className="py-2">{new Date(run.finishedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>No completed automation runs have been recorded yet.</div>
              )
            ) : (
              <div>Automation metrics aren’t enabled on this deployment.</div>
            )}
            <div className="text-xs text-muted-foreground">This endpoint exposes timestamps only (no secrets).</div>
          </CardContent>
        </Card>

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

async function getBaseUrl(): Promise<string> {
  const h = await headers()
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

