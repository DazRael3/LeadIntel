import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { computeDataHealthSummary } from '@/lib/services/data-health'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Data health | LeadIntel',
  description: 'Admin-only data health and source coverage visibility.',
  robots: { index: false, follow: false },
}

function toneForErrors(errors: number): { cls: string; label: string } {
  if (errors <= 0) return { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200', label: 'Healthy' }
  if (errors <= 3) return { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-200', label: 'Degraded' }
  return { cls: 'border-red-500/30 bg-red-500/10 text-red-200', label: 'Unhealthy' }
}

export default async function AdminDataHealthPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  if (!isValidAdminToken(token)) notFound()

  const summary = await computeDataHealthSummary()

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <PageViewTrack event="admin_data_health_viewed" props={{ page: 'data_health' }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Data health</div>
          <div className="text-sm text-muted-foreground">Admin-only visibility into source freshness, errors, and ingestion volume.</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/ops?token=${encodeURIComponent(token ?? '')}`}>Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/run-health?token=${encodeURIComponent(token ?? '')}`}>Run health</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ingestion volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Tracked accounts: {summary.leadsTracked}</Badge>
            <Badge variant="outline">Signals (24h): {summary.signals.last24h}</Badge>
            <Badge variant="outline">Signals (7d): {summary.signals.last7d}</Badge>
            <Badge variant="outline">Visitors (24h): {summary.websiteVisitors.last24h}</Badge>
            <Badge variant="outline">Visitors (14d): {summary.websiteVisitors.last14d}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">Updated {new Date(summary.updatedAt).toLocaleString()}</div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Company source snapshots (24h)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                <th className="text-left py-2 pr-3">Source</th>
                <th className="text-left py-2 pr-3">Fetched</th>
                <th className="text-left py-2 pr-3">Errors</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.companySnapshots.byType).map(([type, row]) => {
                const tone = toneForErrors(row.errorsLast24h)
                return (
                  <tr key={type} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3 font-medium text-foreground">{type}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.fetchedLast24h}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.errorsLast24h}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={tone.cls}>
                        {tone.label}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Operator notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>Signals and visitor ingestion are best-effort inputs. When coverage is thin, the product should surface “limited data” states rather than guessing.</div>
          <div>Source snapshot errors are internal diagnostics; they should never be exposed directly to end users.</div>
        </CardContent>
      </Card>
    </div>
  )
}

