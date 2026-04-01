import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { requireAdminSessionOrNotFound } from '@/lib/admin/session'
import { adminListRecentUsageEvents } from '@/lib/services/admin-queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Generations ops | LeadIntel',
  description: 'Admin-only generation and usage ledger visibility.',
  robots: { index: false, follow: false },
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

function statusBadge(status: string) {
  const v = status.toLowerCase()
  const variant = v === 'complete' ? 'outline' : v === 'cancelled' ? 'secondary' : 'secondary'
  return <Badge variant={variant as 'outline' | 'secondary' | 'destructive'}>{status}</Badge>
}

export default async function AdminGenerationsOpsPage() {
  await requireAdminSessionOrNotFound()

  const rows = await adminListRecentUsageEvents(200)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <PageViewTrack event="admin_generations_viewed" props={{ page: 'generations_ops' }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Generations ops</div>
          <div className="text-sm text-muted-foreground">Admin-only view of the premium-generation usage ledger (no content).</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/ops">Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/run-health">Run health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/webhooks">Webhooks</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent usage events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto text-sm text-muted-foreground">
          {rows.length === 0 ? (
            <div>No usage events recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Time</th>
                  <th className="text-left py-2 pr-3">User</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2 pr-3">Object</th>
                  <th className="text-left py-2">Object id</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{truncate(r.user_id, 10)}</td>
                    <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-2 pr-3">{r.object_type ?? '—'}</td>
                    <td className="py-2">{r.object_id ? truncate(r.object_id, 14) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

