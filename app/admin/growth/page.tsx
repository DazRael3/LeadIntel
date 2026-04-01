import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { serverEnv } from '@/lib/env'
import { readLatestJobRuns } from '@/lib/jobs/persist'
import { runJob } from '@/lib/jobs/runJob'
import type { JobName } from '@/lib/jobs/types'
import { getPostHogApiConfig, queryHogQL } from '@/lib/posthog/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { seedPublishQueue } from '@/lib/growth/seedPublishQueue'
import { CopyTextButton } from '@/components/admin/CopyTextButton'
import { requireAdminSessionOrNotFound } from '@/lib/admin/session'

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

type PublishQueueRow = {
  id: string
  type: string
  slug: string
  status: string
  scheduled_for: string
  published_at: string | null
  last_error: string | null
  created_at: string
}

type PostQueueRow = {
  id: string
  channel: string
  status: string
  related_url: string
  content: string
  created_at: string
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

export default async function AdminGrowthOpsPage() {
  await requireAdminSessionOrNotFound()

  async function seedQueuesNow(_formData: FormData) {
    'use server'
    await requireAdminSessionOrNotFound()
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    await seedPublishQueue({ supabase })
    revalidatePath('/admin/growth')
  }

  async function runNow(formData: FormData) {
    'use server'
    await requireAdminSessionOrNotFound()
    const job = String(formData.get('job') ?? '') as JobName
    const allowed: JobName[] = ['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit', 'growth_cycle']
    if (!allowed.includes(job)) notFound()
    await runJob(job, { triggeredBy: 'admin' })
    revalidatePath('/admin/growth')
  }

  async function retryPublishQueue(formData: FormData) {
    'use server'
    await requireAdminSessionOrNotFound()
    const id = String(formData.get('id') ?? '')
    if (!id) notFound()
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const nowIso = new Date().toISOString()
    await supabase.from('publish_queue').update({ status: 'queued', scheduled_for: nowIso, last_error: null }).eq('id', id)
    revalidatePath('/admin/growth')
  }

  async function retryAllFailed(_formData: FormData) {
    'use server'
    await requireAdminSessionOrNotFound()
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const nowIso = new Date().toISOString()
    await supabase.from('publish_queue').update({ status: 'queued', scheduled_for: nowIso, last_error: null }).eq('status', 'failed')
    revalidatePath('/admin/growth')
  }

  async function markPosted(formData: FormData) {
    'use server'
    await requireAdminSessionOrNotFound()
    const id = String(formData.get('id') ?? '')
    if (!id) notFound()
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    await supabase.from('post_queue').update({ status: 'posted' }).eq('id', id)
    revalidatePath('/admin/growth')
  }

  const jobRuns = await readLatestJobRuns(20)
  const kpis = await getKpis24h()

  let publishQueueEnabled = false
  let publishQueue: PublishQueueRow[] = []
  let postQueueEnabled = false
  let postQueue: PostQueueRow[] = []
  let lastDistributionAt: string | null = null
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    publishQueueEnabled = true
    postQueueEnabled = true

    const [{ data: pq }, { data: posts }, { data: state }] = await Promise.all([
      supabase
        .from('publish_queue')
        .select('id, type, slug, status, scheduled_for, published_at, last_error, created_at')
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('post_queue')
        .select('id, channel, status, related_url, content, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('growth_state').select('last_distribution_at').eq('key', 'growth_cycle').maybeSingle(),
    ])

    publishQueue = (pq ?? []) as unknown as PublishQueueRow[]
    postQueue = (posts ?? []) as unknown as PostQueueRow[]
    lastDistributionAt = (state as { last_distribution_at?: string | null } | null)?.last_distribution_at ?? null
  } catch {
    publishQueueEnabled = false
    postQueueEnabled = false
    publishQueue = []
    postQueue = []
    lastDistributionAt = null
  }

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
            {(['growth_cycle', 'lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit'] as JobName[]).map((job) => (
              <form key={job} action={runNow}>
                <input type="hidden" name="job" value={job} />
                <Button type="submit" className={job === 'growth_cycle' ? 'neon-border hover:glow-effect' : ''} variant={job === 'growth_cycle' ? 'default' : 'outline'}>
                  Run {job.replace('_', ' ')}
                </Button>
              </form>
            ))}
            <form action={seedQueuesNow}>
              <Button type="submit" variant="outline">
                Seed publish queue
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">Growth cycle</CardTitle>
              <Badge variant="outline">publish + distribution + post drafts</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <div>
              Last distribution:{' '}
              <span className="text-foreground font-medium">{lastDistributionAt ? lastDistributionAt : 'Not sent yet'}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={retryAllFailed}>
                <Button type="submit" variant="outline">
                  Retry failed publishes
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Publish queue</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {!publishQueueEnabled ? (
              <div>Publish queue storage isn’t enabled on this deployment.</div>
            ) : publishQueue.length === 0 ? (
              <div>No queue entries yet. Use “Seed publish queue”.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3">Type</th>
                      <th className="text-left py-2 pr-3">Slug</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Scheduled</th>
                      <th className="text-left py-2 pr-3">Published</th>
                      <th className="text-left py-2 pr-3">Error</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishQueue.map((r) => (
                      <tr key={r.id} className="border-b border-cyan-500/10 align-top">
                        <td className="py-2 pr-3 font-medium text-foreground">{r.type}</td>
                        <td className="py-2 pr-3">{r.slug}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{r.status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs">{r.scheduled_for}</td>
                        <td className="py-2 pr-3 text-xs">{r.published_at ?? '—'}</td>
                        <td className="py-2 pr-3 text-xs text-red-300">{r.last_error ?? ''}</td>
                        <td className="py-2">
                          {r.status === 'failed' ? (
                            <form action={retryPublishQueue}>
                              <input type="hidden" name="id" value={r.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Retry
                              </Button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Post queue (drafts)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {!postQueueEnabled ? (
              <div>Post queue storage isn’t enabled on this deployment.</div>
            ) : postQueue.length === 0 ? (
              <div>No post drafts queued yet.</div>
            ) : (
              <div className="space-y-4">
                {postQueue.map((p) => (
                  <div key={p.id} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs">
                        <span className="font-medium text-foreground">{p.channel}</span>{' '}
                        <Badge variant="outline">{p.status}</Badge>
                        <div className="mt-1">
                          <a className="text-cyan-400 hover:underline" href={p.related_url} target="_blank" rel="noreferrer">
                            {p.related_url}
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyTextButton text={p.content} />
                        {p.status !== 'posted' ? (
                          <form action={markPosted}>
                            <input type="hidden" name="id" value={p.id} />
                            <Button size="sm" variant="outline" type="submit">
                              Mark posted
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{p.content}</pre>
                  </div>
                ))}
              </div>
            )}
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

