import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { requireAdminSessionOrNotFound } from '@/lib/admin/session'
import { computeRunHealth } from '@/lib/services/run-health'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Run health | LeadIntel',
  description: 'Admin-only run health and pipeline observability.',
  robots: { index: false, follow: false },
}

function statBadge(label: string, value: number, tone: 'ok' | 'warn' | 'bad' = 'ok') {
  const cls =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : 'border-red-500/30 bg-red-500/10 text-red-200'
  return (
    <Badge variant="outline" className={cls}>
      {label}: {value}
    </Badge>
  )
}

export default async function AdminRunHealthPage() {
  await requireAdminSessionOrNotFound()

  const [h24, h7] = await Promise.all([computeRunHealth('24h'), computeRunHealth('7d')])

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <PageViewTrack event="admin_run_health_viewed" props={{ window: '24h' }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Run health</div>
          <div className="text-sm text-muted-foreground">Admin-only operational visibility across generations, exports, webhooks, and automation runs.</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/ops">Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/data-health">Data health</Link>
          </Button>
        </div>
      </div>

      {[h24, h7].map((h) => {
        const exportTone = h.exports.failed > 0 ? 'bad' : h.exports.pending > 0 ? 'warn' : 'ok'
        const webhookTone = h.webhooks.failed > 0 ? 'bad' : h.webhooks.retryBacklogDue > 0 ? 'warn' : 'ok'
        return (
          <Card key={h.window} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{h.window === '24h' ? 'Last 24 hours' : 'Last 7 days'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2">
                {statBadge('Pitches', h.usageEvents.pitchComplete)}
                {statBadge('Reports', h.usageEvents.reportComplete)}
                {statBadge('Cancelled reservations', h.usageEvents.reservationsCancelled, h.usageEvents.reservationsCancelled > 0 ? 'warn' : 'ok')}
              </div>
              <div className="flex flex-wrap gap-2">
                {statBadge('Exports ready', h.exports.ready)}
                {statBadge('Exports pending', h.exports.pending, h.exports.pending > 0 ? 'warn' : 'ok')}
                {statBadge('Exports failed', h.exports.failed, exportTone)}
              </div>
              <div className="flex flex-wrap gap-2">
                {statBadge('Webhook sent', h.webhooks.sent)}
                {statBadge('Webhook pending', h.webhooks.pending, h.webhooks.pending > 0 ? 'warn' : 'ok')}
                {statBadge('Webhook failed', h.webhooks.failed, webhookTone)}
                {statBadge('Retry backlog due', h.webhooks.retryBacklogDue, h.webhooks.retryBacklogDue > 0 ? 'warn' : 'ok')}
              </div>

              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation runs</div>
                {h.jobs.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">No job runs recorded in this window.</div>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-3">Job</th>
                          <th className="text-left py-2 pr-3">ok</th>
                          <th className="text-left py-2 pr-3">error</th>
                          <th className="text-left py-2">skipped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {h.jobs.map((j) => (
                          <tr key={j.jobName} className="border-b border-cyan-500/10">
                            <td className="py-2 pr-3 font-medium text-foreground">{j.jobName}</td>
                            <td className="py-2 pr-3">{j.ok}</td>
                            <td className="py-2 pr-3">{j.error}</td>
                            <td className="py-2">{j.skipped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">Since: {new Date(h.sinceIso).toLocaleString()}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

