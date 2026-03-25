import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyTextButton } from '@/components/admin/CopyTextButton'
import { runEnvDoctor } from '@/lib/ops/envDoctor'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { AdminKpiMonitorPanelClient } from './AdminKpiMonitorPanelClient'
import { computeOpsHealth, type OpsHealthCheckStatus } from '@/lib/ops/opsHealth'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { readLatestJobRuns } from '@/lib/jobs/persist'
import { lifecycleEmailsEnabled, adminNotificationsEnabled, getLifecycleAdminEmails } from '@/lib/lifecycle/config'
import { prospectWatchEnabled, prospectDailyDigestEnabled, contentDailyDigestEnabled, getReviewEmails } from '@/lib/prospect-watch/config'
import { getAppUrl } from '@/lib/app-url'
import { qaAllEmailTemplates } from '@/lib/email/qa'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ops | LeadIntel',
  description: 'Admin ops diagnostics for environment and audits.',
  robots: { index: false, follow: false },
}

function requireAdminToken(token: string | null): void {
  if (!isValidAdminToken(token)) notFound()
}

type ContentAuditReportRow = {
  id: string
  created_at: string
  status: string
  summary: string
  failures: unknown
}

type Failure = { code: string; message: string; path?: string }

function asFailures(v: unknown): Failure[] {
  if (!Array.isArray(v)) return []
  const out: Failure[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const i = item as Record<string, unknown>
    const code = typeof i.code === 'string' ? i.code : null
    const message = typeof i.message === 'string' ? i.message : null
    const path = typeof i.path === 'string' ? i.path : undefined
    if (!code || !message) continue
    out.push({ code, message, ...(path ? { path } : {}) })
  }
  return out
}

function StatusBadge(props: { status: string }) {
  const s = props.status.toLowerCase()
  const variant = s === 'ok' ? 'outline' : s === 'error' ? 'destructive' : 'secondary'
  return <Badge variant={variant as 'outline' | 'secondary' | 'destructive'}>{props.status}</Badge>
}

function CheckStatusBadge(props: { status: OpsHealthCheckStatus }) {
  const variant = props.status === 'ok' ? 'outline' : props.status === 'error' ? 'destructive' : 'secondary'
  return <Badge variant={variant as 'outline' | 'secondary' | 'destructive'}>{props.status}</Badge>
}

type JobRunRow = {
  job_name: string
  status: string
  started_at: string
  finished_at: string
  summary: unknown
  error_text: string | null
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString()
}

function lastByJob(runs: JobRunRow[], job: string): JobRunRow | null {
  return runs.find((r) => r.job_name === job) ?? null
}

export default async function AdminOpsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  requireAdminToken(token)

  const opsHealth = await computeOpsHealth().catch(() => null)
  const env = runEnvDoctor()
  const jobRuns = await readLatestJobRuns(30).catch(() => ({ enabled: false, runs: [] as Array<Record<string, unknown>> }))
  const runs = (jobRuns.runs as unknown as JobRunRow[]).filter((r) => r && typeof r.job_name === 'string')

  const lifecycleRun = lastByJob(runs, 'lifecycle')
  const prospectWatchRun = lastByJob(runs, 'prospect_watch')
  const prospectDigestRun = lastByJob(runs, 'prospect_watch_digest')

  let prospectReviewCount: number | null = null
  let contentDraftCount: number | null = null
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const prospectsRes = await admin
      .from('prospect_watch_prospects')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'reviewed'])
    prospectReviewCount = typeof prospectsRes.count === 'number' ? prospectsRes.count : 0

    const contentRes = await admin
      .from('prospect_watch_content_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft')
    contentDraftCount = typeof contentRes.count === 'number' ? contentRes.count : 0
  } catch {
    prospectReviewCount = null
    contentDraftCount = null
  }

  let report: ContentAuditReportRow | null = null
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data } = await admin
      .from('content_audit_reports')
      .select('id, created_at, status, summary, failures')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    report = (data ?? null) as ContentAuditReportRow | null
  } catch {
    report = null
  }

  const failures = asFailures(report?.failures)
  const emailQa = qaAllEmailTemplates({ appUrl: getAppUrl() })
  const emailQaCounts = {
    ok: emailQa.filter((r) => r.severity === 'ok').length,
    warn: emailQa.filter((r) => r.severity === 'warn').length,
    error: emailQa.filter((r) => r.severity === 'error').length,
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Ops</div>
          <div className="text-sm text-muted-foreground">Environment diagnostics and latest content audit report.</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/growth?token=${encodeURIComponent(token ?? '')}`}>Growth Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/refinement?token=${encodeURIComponent(token ?? '')}`}>Refinement</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/run-health?token=${encodeURIComponent(token ?? '')}`}>Run health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/data-health?token=${encodeURIComponent(token ?? '')}`}>Data health</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/generations?token=${encodeURIComponent(token ?? '')}`}>Generations</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/webhooks?token=${encodeURIComponent(token ?? '')}`}>Webhooks</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/support?token=${encodeURIComponent(token ?? '')}`}>Support</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/email?token=${encodeURIComponent(token ?? '')}`}>Email Lab</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/status">Status</Link>
          </Button>
        </div>
      </div>

      {opsHealth ? (
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ops health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{opsHealth.score}/100</Badge>
              <Badge variant="outline">{opsHealth.grade}</Badge>
              <div className="text-xs text-muted-foreground">Updated {new Date(opsHealth.updatedAt).toLocaleString()}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-3">Check</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Weight</th>
                    <th className="text-left py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {opsHealth.checks.map((c) => (
                    <tr key={c.key} className="border-b border-cyan-500/10">
                      <td className="py-2 pr-3 font-medium text-foreground">{c.label}</td>
                      <td className="py-2 pr-3">
                        <CheckStatusBadge status={c.status} />
                      </td>
                      <td className="py-2 pr-3">{c.weight}</td>
                      <td className="py-2 text-xs text-muted-foreground">{c.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ops health</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Unable to compute ops health on this deployment.</CardContent>
        </Card>
      )}

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Env Doctor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {env.subsystems.map((s) => (
            <div key={s.key} className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-foreground">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.impact}</div>
                </div>
                <Badge variant="outline">{s.configured ? 'Configured' : 'Missing'}</Badge>
              </div>
              {s.missingKeys.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="text-xs text-muted-foreground">Missing keys:</div>
                  <CopyTextButton text={s.missingKeys.join('\n')} />
                  <div className="w-full text-xs text-muted-foreground">{s.missingKeys.join(', ')}</div>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Automation status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Lifecycle emails: {lifecycleEmailsEnabled() ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">Operator notifications: {adminNotificationsEnabled() ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">Prospect watch: {prospectWatchEnabled() ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">Prospect digests: {prospectDailyDigestEnabled() ? 'Enabled' : 'Disabled'}</Badge>
            <Badge variant="outline">Content digests: {contentDailyDigestEnabled() ? 'Enabled' : 'Disabled'}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs font-medium text-foreground">Last lifecycle run</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={lifecycleRun?.status ?? (jobRuns.enabled ? 'none' : 'unavailable')} />
                <div className="text-xs">Finished {formatWhen(lifecycleRun?.finished_at ?? null)}</div>
              </div>
              {lifecycleRun?.error_text ? <div className="mt-2 text-xs text-amber-200">Error: {lifecycleRun.error_text}</div> : null}
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs font-medium text-foreground">Last prospect watch run</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={prospectWatchRun?.status ?? (jobRuns.enabled ? 'none' : 'unavailable')} />
                <div className="text-xs">Finished {formatWhen(prospectWatchRun?.finished_at ?? null)}</div>
              </div>
              {prospectWatchRun?.error_text ? <div className="mt-2 text-xs text-amber-200">Error: {prospectWatchRun.error_text}</div> : null}
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs font-medium text-foreground">Last digest run</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={prospectDigestRun?.status ?? (jobRuns.enabled ? 'none' : 'unavailable')} />
                <div className="text-xs">Finished {formatWhen(prospectDigestRun?.finished_at ?? null)}</div>
              </div>
              {prospectDigestRun?.error_text ? <div className="mt-2 text-xs text-amber-200">Error: {prospectDigestRun.error_text}</div> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">Prospects awaiting review: {prospectReviewCount === null ? '—' : prospectReviewCount}</Badge>
            <Badge variant="outline">Content drafts awaiting review: {contentDraftCount === null ? '—' : contentDraftCount}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/prospects">Open prospect queue</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/content">Open content queue</Link>
            </Button>
          </div>

          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs font-medium text-foreground">Routing</div>
            <div className="mt-1 text-xs">Operator inboxes:</div>
            <div className="mt-1 text-xs text-muted-foreground">
              <div>Lifecycle admin emails: {getLifecycleAdminEmails().length > 0 ? getLifecycleAdminEmails().join(', ') : '—'}</div>
              <div>Prospect watch review emails: {getReviewEmails().length > 0 ? getReviewEmails().join(', ') : '—'}</div>
            </div>
          </div>

          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-foreground">Email template health</div>
                <div className="mt-1 text-xs text-muted-foreground">Baseline QA on registry templates (subject/body/CTA/prefs link).</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">OK: {emailQaCounts.ok}</Badge>
                <Badge variant="outline">Warn: {emailQaCounts.warn}</Badge>
                <Badge variant={emailQaCounts.error > 0 ? 'destructive' : 'outline'}>Error: {emailQaCounts.error}</Badge>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/email?token=${encodeURIComponent(token ?? '')}`}>Open Email Lab</Link>
              </Button>
              <div className="text-xs text-muted-foreground">Use Email Lab to preview/test-send (operator allowlist only, deduped).</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Latest content audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {report ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-foreground font-medium">Status</div>
                <StatusBadge status={report.status} />
                <div className="text-xs text-muted-foreground">Run at {new Date(report.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-muted-foreground">{report.summary}</div>
              {failures.length > 0 ? (
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-foreground">Failures ({failures.length})</div>
                    <CopyTextButton
                      text={failures.map((f) => `${f.code}: ${f.message}${f.path ? ` (${f.path})` : ''}`).join('\n')}
                    />
                  </div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {failures.map((f, idx) => (
                      <li key={`${f.code}-${idx}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{f.code}</span>: {f.message}{' '}
                        {f.path ? (
                          <Link className="text-cyan-400 hover:underline" href={f.path.startsWith('/') ? f.path : `/${f.path}`}>
                            {f.path}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No failures recorded.</div>
              )}
            </>
          ) : (
            <div>No content audit report recorded yet.</div>
          )}
        </CardContent>
      </Card>

      <AdminKpiMonitorPanelClient token={token} />
    </div>
  )
}

