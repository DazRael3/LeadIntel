import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { serverEnv } from '@/lib/env'
import { readLatestJobRuns } from '@/lib/jobs/persist'
import { runJob } from '@/lib/jobs/runJob'
import type { JobName } from '@/lib/jobs/types'
import { getPostHogApiConfig, queryHogQL } from '@/lib/posthog/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Growth Ops | LeadIntel',
  description: 'Admin Growth Ops dashboard for jobs and KPIs.',
  robots: { index: false, follow: false },
}

type JobRunRow = {
  id: string
  job_name: string
  triggered_by: string
  status: string
  started_at: string
  finished_at: string
  summary: unknown
  error_text: string | null
}

function isEnabledResend(): boolean {
  return Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean((serverEnv.RESEND_FROM_EMAIL ?? '').trim())
}

function isEnabledCronProtection(): boolean {
  return Boolean((serverEnv.CRON_SECRET ?? '').trim())
}

function isEnabledPostHogReads(): boolean {
  return Boolean(getPostHogApiConfig())
}

function requireAdminToken(token: string | null): void {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  if (!expected) notFound()
  if (!token || token !== expected) notFound()
}

async function getKpis24h(): Promise<{ enabled: boolean; rows: Array<{ metric: string; count: number }> }> {
  const cfg = getPostHogApiConfig()
  if (!cfg) return { enabled: false, rows: [] }

  const now = new Date()
  const end = now.toISOString()
  const start = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()

  const events = [
    'landing_try_sample_submitted',
    'landing_sample_generated',
    'cta_signup_clicked',
    'signup_completed',
    'activation_completed',
    'upgrade_clicked',
  ]

  const rows: Array<{ metric: string; count: number }> = []
  for (const e of events) {
    const q = `SELECT count() FROM events WHERE event = '${e.replace(/'/g, "''")}' AND timestamp >= toDateTime('${start}') AND timestamp < toDateTime('${end}')`
    const count = await queryHogQL({ config: cfg, query: q })
    rows.push({ metric: e, count })
  }
  return { enabled: true, rows }
}

function Integration(props: { label: string; enabled: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
      <div>
        <div className="text-xs font-medium text-foreground">{props.label}</div>
        <div className="text-xs text-muted-foreground">{props.note}</div>
      </div>
      <Badge variant="outline">{props.enabled ? 'Enabled' : 'Not enabled'}</Badge>
    </div>
  )
}

export default async function AdminGrowthOpsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  requireAdminToken(token)

  async function runNow(formData: FormData) {
    'use server'
    const tok = String(formData.get('token') ?? '')
    requireAdminToken(tok)
    const job = String(formData.get('job') ?? '') as JobName
    const allowed: JobName[] = ['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit']
    if (!allowed.includes(job)) notFound()
    await runJob(job, { triggeredBy: 'admin' })
    revalidatePath('/admin/growth')
  }

  const jobRuns = await readLatestJobRuns(20)
  const kpis = await getKpis24h()

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Growth Ops</h1>
          <p className="mt-1 text-sm text-muted-foreground">Jobs, KPIs, and alerts. Secrets are never shown.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Integrations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Integration label="Resend" enabled={isEnabledResend()} note="Email sending" />
            <Integration
              label="PostHog KPI monitor"
              enabled={isEnabledPostHogReads()}
              note={isEnabledPostHogReads() ? 'API reads enabled' : 'Not enabled (events still captured)'}
            />
            <Integration label="Cron protection" enabled={isEnabledCronProtection()} note="CRON_SECRET present" />
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest job runs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {jobRuns.enabled ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">Job</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Started</th>
                      <th className="text-left py-2 pr-3">Finished</th>
                      <th className="text-left py-2">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobRuns.runs as unknown as JobRunRow[]).map((r) => (
                      <tr key={r.id} className="border-b border-cyan-500/10 align-top">
                        <td className="py-2 pr-3 font-medium text-foreground">{r.job_name}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{r.status}</Badge>
                        </td>
                        <td className="py-2 pr-3">{r.started_at}</td>
                        <td className="py-2 pr-3">{r.finished_at}</td>
                        <td className="py-2 text-xs">
                          <pre className="whitespace-pre-wrap text-muted-foreground">
                            {JSON.stringify(r.summary ?? {}, null, 2)}
                          </pre>
                          {r.error_text ? <div className="mt-2 text-xs text-red-400">{r.error_text}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>Job run storage isn’t enabled on this deployment.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run a job now</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit'] as JobName[]).map((job) => (
              <form key={job} action={runNow}>
                <input type="hidden" name="token" value={token ?? ''} />
                <input type="hidden" name="job" value={job} />
                <Button type="submit" className={job === 'lifecycle' ? 'neon-border hover:glow-effect' : ''} variant={job === 'lifecycle' ? 'default' : 'outline'}>
                  Run {job.replace('_', ' ')}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">KPIs (last 24h)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {kpis.enabled ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {kpis.rows.map((r) => (
                  <div
                    key={r.metric}
                    className="rounded border border-cyan-500/10 bg-background/40 px-3 py-2 flex items-center justify-between"
                  >
                    <div className="text-xs">{r.metric}</div>
                    <Badge variant="outline">{r.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div>PostHog API access not enabled for KPI reads. Events are still being captured.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

