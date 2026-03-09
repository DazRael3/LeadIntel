import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { buildSupportContext, lookupUserIdByEmail } from '@/lib/services/support-tools'
import { badgeClassForTone, exportJobStatusLabel } from '@/lib/ui/status-labels'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Support | LeadIntel',
  description: 'Admin-only support context (metadata-first).',
  robots: { index: false, follow: false },
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export default async function AdminSupportPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  if (!isValidAdminToken(token)) notFound()

  const userIdParam = typeof sp.userId === 'string' ? sp.userId.trim() : ''
  const emailParam = typeof sp.email === 'string' ? sp.email.trim() : ''
  const resolvedUserId = userIdParam || (emailParam ? await lookupUserIdByEmail(emailParam) : null) || null

  const ctx = resolvedUserId ? await buildSupportContext({ userId: resolvedUserId }) : null

  const tokenQs = `token=${encodeURIComponent(token ?? '')}`

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <PageViewTrack event="admin_support_viewed" props={{ page: 'support' }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Support context</div>
          <div className="text-sm text-muted-foreground">Metadata-first debugging (no premium content exposure by default).</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/ops?${tokenQs}`}>Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/run-health?${tokenQs}`}>Run health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/generations?${tokenQs}`}>Generations</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lookup</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <form method="GET" action="/admin/support" className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input type="hidden" name="token" value={token ?? ''} />
            <input
              name="userId"
              defaultValue={userIdParam}
              placeholder="user id (uuid)"
              className="h-9 w-full rounded border border-cyan-500/20 bg-background px-3 text-sm"
            />
            <input
              name="email"
              defaultValue={emailParam}
              placeholder="email"
              className="h-9 w-full rounded border border-cyan-500/20 bg-background px-3 text-sm"
            />
            <div className="md:col-span-3">
              <Button size="sm" variant="outline">
                Load context
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {resolvedUserId && !ctx ? (
        <Card className="border-cyan-500/20 bg-card/60">
          <CardContent className="py-4 text-sm text-muted-foreground">User not found, or support context unavailable.</CardContent>
        </Card>
      ) : null}

      {ctx ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{truncate(ctx.user.id, 12)}</Badge>
                {ctx.user.email ? <Badge variant="outline">{ctx.user.email}</Badge> : <Badge variant="outline">email —</Badge>}
                {ctx.user.displayName ? <Badge variant="outline">{ctx.user.displayName}</Badge> : null}
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Entitlement</div>
                <div className="mt-1 text-sm text-foreground">
                  {ctx.tier.tier} · {ctx.tier.plan}
                  {ctx.tier.subscriptionStatus ? ` · ${ctx.tier.subscriptionStatus}` : ''}
                </div>
                {ctx.tier.stripeTrialEnd ? <div className="mt-1 text-xs text-muted-foreground">Trial ends: {ctx.tier.stripeTrialEnd}</div> : null}
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage ledger</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">pitches: {ctx.usage.completePitch}</Badge>
                  <Badge variant="outline">reports: {ctx.usage.completeReport}</Badge>
                  <Badge variant="outline">reserved: {ctx.usage.reservedActive}</Badge>
                  <Badge variant="outline">cancelled (24h): {ctx.usage.cancelled24h}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent activity (metadata)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage events</div>
                {ctx.recentUsageEvents.length === 0 ? (
                  <div className="mt-2 text-sm">No usage events.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {ctx.recentUsageEvents.map((e) => (
                      <div key={e.id} className="rounded border border-cyan-500/10 bg-background/40 p-2 text-xs">
                        <div className="text-foreground">
                          {e.status} · {e.object_type ?? '—'} · {e.object_id ? truncate(e.object_id, 12) : '—'}
                        </div>
                        <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reports</div>
                {ctx.recentReports.length === 0 ? (
                  <div className="mt-2 text-sm">No reports.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {ctx.recentReports.map((r) => (
                      <div key={r.id} className="rounded border border-cyan-500/10 bg-background/40 p-2 text-xs">
                        <div className="text-foreground">{r.report_kind ?? 'report'} · {r.status}</div>
                        <div className="text-muted-foreground">{r.title ?? truncate(r.id, 12)}</div>
                        <div className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Exports</div>
                {ctx.recentExports.length === 0 ? (
                  <div className="mt-2 text-sm">No export jobs.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {ctx.recentExports.map((j) => {
                      const st = exportJobStatusLabel(j.status as 'pending' | 'ready' | 'failed')
                      return (
                        <div key={j.id} className="rounded border border-cyan-500/10 bg-background/40 p-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground font-medium">{j.type}</span>
                            <Badge variant="outline" className={badgeClassForTone(st.tone)}>
                              {st.label}
                            </Badge>
                          </div>
                          {j.error ? <div className="mt-1 text-muted-foreground">{truncate(j.error, 140)}</div> : null}
                          <div className="text-muted-foreground">{new Date(j.created_at).toLocaleString()}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

