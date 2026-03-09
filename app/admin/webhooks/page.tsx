import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { adminListRecentWebhookDeliveries, adminListWebhookEndpoints } from '@/lib/services/admin-queries'
import { badgeClassForTone, webhookDeliveryStatusLabel } from '@/lib/ui/status-labels'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Webhooks ops | LeadIntel',
  description: 'Admin-only webhook operations view.',
  robots: { index: false, follow: false },
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export default async function AdminWebhooksOpsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  if (!isValidAdminToken(token)) notFound()

  const [endpoints, deliveries] = await Promise.all([adminListWebhookEndpoints(200), adminListRecentWebhookDeliveries(200)])

  const endpointUrlById = new Map(endpoints.map((e) => [e.id, e.url]))

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <PageViewTrack event="admin_webhooks_viewed" props={{ page: 'webhooks_ops' }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Webhooks ops</div>
          <div className="text-sm text-muted-foreground">Admin-only endpoint and delivery visibility (sanitized).</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/ops?token=${encodeURIComponent(token ?? '')}`}>Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/run-health?token=${encodeURIComponent(token ?? '')}`}>Run health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/generations?token=${encodeURIComponent(token ?? '')}`}>Generations</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {endpoints.length === 0 ? (
            <div className="text-sm text-muted-foreground">No endpoints configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Workspace</th>
                  <th className="text-left py-2 pr-3">URL</th>
                  <th className="text-left py-2 pr-3">Enabled</th>
                  <th className="text-left py-2 pr-3">Failures</th>
                  <th className="text-left py-2">Last success / error</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((e) => (
                  <tr key={e.id} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3 text-muted-foreground">{truncate(e.workspace_id, 10)}</td>
                    <td className="py-2 pr-3 text-foreground">{truncate(e.url, 80)}</td>
                    <td className="py-2 pr-3">{e.is_enabled ? 'yes' : 'no'}</td>
                    <td className="py-2 pr-3">{e.failure_count}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {e.last_success_at ? `ok ${new Date(e.last_success_at).toLocaleString()}` : 'ok —'} ·{' '}
                      {e.last_error_at ? `err ${new Date(e.last_error_at).toLocaleString()}` : 'err —'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {deliveries.length === 0 ? (
            <div className="text-sm text-muted-foreground">No deliveries recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Time</th>
                  <th className="text-left py-2 pr-3">Endpoint</th>
                  <th className="text-left py-2 pr-3">Event</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => {
                  const label = webhookDeliveryStatusLabel(d.status, d.attempts)
                  const url = endpointUrlById.get(d.endpoint_id) ?? d.endpoint_id
                  return (
                    <tr key={d.id} className="border-b border-cyan-500/10">
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3 text-foreground">{truncate(url, 60)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{d.event_type}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={badgeClassForTone(label.tone)}>
                          {label.label}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {d.last_status ? `HTTP ${d.last_status}` : d.last_error ? truncate(d.last_error, 140) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

