import { NextRequest } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'
import { getAutomationJobConfig, hasAnyCronSecret } from '@/lib/observability/automation-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AutomationSummary = {
  monitoredJobs: number
  recentSuccess: boolean
  stale: boolean
  missingJobs: number
  failedJobs: number
  staleJobs: number
  healthyJobs: number
  externalJobs: number
}

type SchedulerDependency = {
  job: JobName
  wiring: 'vercel_cron' | 'external_scheduler'
  required: boolean
  enabled: boolean
  reason: string
}

type SchedulerSummary = {
  requiredJobs: number
  requiredExternalJobs: number
  missingRequiredJobs: number
  missingExternalJobs: number
  warnings: string[]
  jobs: Array<{
    job: JobName
    wiring: 'vercel_cron' | 'external_scheduler'
    required: boolean
    enabled: boolean
    healthy: boolean | null
    state: 'healthy' | 'stale' | 'missing' | 'failed' | 'external' | 'disabled'
  }>
}

type AutomationHealthStatus = 'healthy' | 'degraded' | 'stale' | 'missing' | 'external_required'

const JOB_STALE_HOURS: Partial<Record<JobName, number>> = {
  lifecycle: 30,
  digest_lite: 8 * 24,
  kpi_monitor: 30,
  content_audit: 30,
  growth_cycle: 30,
  sources_refresh: 30,
  prospect_watch: 30,
  prospect_watch_digest: 30,
  webhook_deliveries: 12,
}

function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

const VERCEL_JSON_PATH = path.join(process.cwd(), 'vercel.json')
let cachedVercelCronJobs: Set<JobName> | null = null

function configuredVercelCronJobs(): Set<JobName> {
  if (cachedVercelCronJobs) return cachedVercelCronJobs
  const jobs = new Set<JobName>()
  try {
    if (!fs.existsSync(VERCEL_JSON_PATH)) {
      cachedVercelCronJobs = jobs
      return jobs
    }
    const raw = fs.readFileSync(VERCEL_JSON_PATH, 'utf8')
    const parsed = JSON.parse(raw) as {
      crons?: Array<{ path?: string }>
    }
    for (const cron of parsed.crons ?? []) {
      if (!cron.path || typeof cron.path !== 'string') continue
      const url = new URL(cron.path, 'https://raelinfo.com')
      const job = url.searchParams.get('job')
      if (
        job === 'lifecycle' ||
        job === 'digest_lite' ||
        job === 'kpi_monitor' ||
        job === 'content_audit' ||
        job === 'growth_cycle' ||
        job === 'sources_refresh' ||
        job === 'prospect_watch' ||
        job === 'prospect_watch_digest' ||
        job === 'webhook_deliveries'
      ) {
        jobs.add(job)
      }
    }
  } catch {
    // Ignore parse errors and fail soft by returning an empty set.
  }
  cachedVercelCronJobs = jobs
  return jobs
}

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function buildSchedulerDependencies(args: { hasEnabledWebhookEndpoints: boolean }): SchedulerDependency[] {
  return getAutomationJobConfig(args)
}

function schedulerWarnings(args: {
  hasEnabledWebhookEndpoints: boolean
  missingExternalJobs: number
  dependencies: SchedulerDependency[]
}): string[] {
  const warnings: string[] = []
  const lifecycleEnabled = flagEnabled(process.env.LIFECYCLE_EMAILS_ENABLED)
  const resendConfigured = Boolean((process.env.RESEND_API_KEY ?? '').trim()) && Boolean((process.env.RESEND_FROM_EMAIL ?? '').trim())
  const prospectEnabled = flagEnabled(process.env.PROSPECT_WATCH_ENABLED)
  const siteReportsEnabled = flagEnabled(process.env.ENABLE_SITE_REPORTS)
  const rssFeedsConfigured = parseCsv(process.env.PROSPECT_WATCH_RSS_FEEDS).length > 0
  const reviewEmailsConfigured = parseCsv(process.env.PROSPECT_WATCH_REVIEW_EMAILS).length > 0
  const vercelCronJobs = configuredVercelCronJobs()
  const missingRequiredVercelSchedules = args.dependencies
    .filter((d) => d.enabled && d.required && d.wiring === 'vercel_cron')
    .filter((d) => !vercelCronJobs.has(d.job))
    .map((d) => d.job)

  if (!hasAnyCronSecret()) {
    warnings.push('Cron secrets are not configured; scheduler routes cannot be authenticated safely.')
  }
  if (missingRequiredVercelSchedules.length > 0) {
    warnings.push(`Missing Vercel cron schedules for required jobs: ${missingRequiredVercelSchedules.join(', ')}.`)
  }
  if (siteReportsEnabled && !(process.env.SITE_REPORT_CRON_SECRET ?? '').trim()) {
    warnings.push('Site reports are enabled but SITE_REPORT_CRON_SECRET is missing.')
  }
  if (args.missingExternalJobs > 0) {
    warnings.push('Required external scheduler jobs are missing, failed, or stale.')
  }
  if (lifecycleEnabled && !resendConfigured) {
    warnings.push('Lifecycle emails are enabled but Resend is not fully configured (RESEND_API_KEY + RESEND_FROM_EMAIL).')
  }
  if (prospectEnabled && !rssFeedsConfigured) {
    warnings.push('Prospect watch is enabled but no RSS feeds are configured.')
  }
  if (prospectEnabled && !reviewEmailsConfigured) {
    warnings.push('Prospect watch is enabled but review email recipients are not configured.')
  }
  if (args.hasEnabledWebhookEndpoints && args.missingExternalJobs > 0) {
    warnings.push('Webhook endpoints are enabled; schedule /api/cron/webhooks to avoid delivery backlog.')
  }
  if (lifecycleEnabled) {
    warnings.push('Lifecycle disqualification stop is not implemented at user-state level; only reply/bounce/unsubscribe/conversion stops are enforced.')
  }
  return warnings
}

function canReadJobRuns(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return url.length > 0 && serviceRole.length > 0
}

function summaryFallback(monitoredJobs: number): AutomationSummary {
  return {
    monitoredJobs,
    recentSuccess: false,
    stale: true,
    missingJobs: monitoredJobs,
    failedJobs: 0,
    staleJobs: monitoredJobs,
    healthyJobs: 0,
    externalJobs: 0,
  }
}

function deriveHealthStatus(summary: AutomationSummary, scheduler: SchedulerSummary): AutomationHealthStatus {
  if (summary.failedJobs > 0) return 'degraded'
  if (scheduler.missingRequiredJobs > 0) {
    return scheduler.missingExternalJobs > 0 ? 'external_required' : 'degraded'
  }
  if (summary.missingJobs > 0) return 'missing'
  if (summary.staleJobs > 0) return 'stale'
  return 'healthy'
}

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  const fallbackDeps = buildSchedulerDependencies({ hasEnabledWebhookEndpoints: false })

  if (!canReadJobRuns()) {
    const requiredJobs = fallbackDeps.filter((d) => d.enabled && d.required).length
    const requiredExternalJobs = fallbackDeps.filter((d) => d.enabled && d.required && d.wiring === 'external_scheduler').length
    const scheduler: SchedulerSummary = {
      requiredJobs,
      requiredExternalJobs,
      missingRequiredJobs: requiredJobs,
      missingExternalJobs: requiredExternalJobs,
      warnings: schedulerWarnings({
        hasEnabledWebhookEndpoints: false,
        missingExternalJobs: requiredExternalJobs,
        dependencies: fallbackDeps,
      }),
      jobs: fallbackDeps.map((d) => ({
        ...d,
        healthy: null,
        state: d.enabled ? (d.wiring === 'external_scheduler' ? 'external' : 'missing') : 'disabled',
      })),
    }
    const summary = summaryFallback(fallbackDeps.filter((d) => d.enabled).length)
    return ok(
      { enabled: false, summary, healthStatus: deriveHealthStatus(summary, scheduler), scheduler },
      undefined,
      bridge,
      requestId
    )
  }

  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const nowMs = Date.now()
    const { count: webhookEndpointCount } = await supabase
      .from('webhook_endpoints')
      .select('id', { count: 'exact', head: true })
      .eq('is_enabled', true)

    const hasEnabledWebhookEndpoints = typeof webhookEndpointCount === 'number' && webhookEndpointCount > 0
    const dependencies = buildSchedulerDependencies({ hasEnabledWebhookEndpoints })
    const monitoredJobs = dependencies.filter((d) => d.enabled).map((d) => d.job)

    const checks = await Promise.all(
      monitoredJobs.map(async (job) => {
        const { data, error } = await supabase
          .from('job_runs')
          .select('status, finished_at')
          .eq('job_name', job)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error || !data) return { job, hasRun: false, success: false, stale: true }

        const status = typeof data.status === 'string' ? data.status : ''
        const finishedAt = typeof data.finished_at === 'string' ? Date.parse(data.finished_at) : Number.NaN
        const maxAgeHours = JOB_STALE_HOURS[job] ?? 30
        const stale = !Number.isFinite(finishedAt) || (nowMs - finishedAt) / (1000 * 60 * 60) > maxAgeHours
        return {
          job,
          hasRun: true,
          success: status === 'ok',
          stale,
        }
      })
    )

    const checkByJob = new Map(checks.map((c) => [c.job, c]))
    const cronSecretConfigured = hasAnyCronSecret()
    const vercelCronJobs = configuredVercelCronJobs()

    const missingJobs = checks.filter((c) => !c.hasRun).length
    const failedJobs = checks.filter((c) => c.hasRun && !c.success).length
    const staleJobs = checks.filter((c) => c.stale).length
    const recentSuccess = checks.every((c) => c.hasRun && c.success)
    const stale = staleJobs > 0
    const schedulerJobs = dependencies.map((dep) => {
      const check = checkByJob.get(dep.job)
      const missingCronAuth = dep.enabled && dep.required && dep.wiring === 'vercel_cron' && !cronSecretConfigured
      const missingVercelSchedule = dep.enabled && dep.required && dep.wiring === 'vercel_cron' && !vercelCronJobs.has(dep.job)
      const healthy = !dep.enabled
        ? null
        : missingCronAuth || missingVercelSchedule
          ? false
          : check
            ? check.hasRun && check.success && !check.stale
            : false
      const state: SchedulerSummary['jobs'][number]['state'] = !dep.enabled
        ? 'disabled'
        : missingCronAuth || missingVercelSchedule
          ? 'missing'
        : !check || !check.hasRun
          ? dep.wiring === 'external_scheduler'
            ? 'external'
            : 'missing'
          : check.stale
            ? 'stale'
            : check.success
              ? 'healthy'
              : 'failed'
      return {
        job: dep.job,
        wiring: dep.wiring,
        required: dep.required,
        enabled: dep.enabled,
        healthy,
        state,
      }
    })
    const requiredJobs = schedulerJobs.filter((j) => j.enabled && j.required).length
    const requiredExternalJobs = schedulerJobs.filter(
      (j) => j.enabled && j.required && j.wiring === 'external_scheduler'
    ).length
    const missingRequiredJobs = schedulerJobs.filter((j) => j.enabled && j.required && j.healthy !== true).length
    const missingExternalJobs = schedulerJobs.filter(
      (j) => j.enabled && j.required && j.wiring === 'external_scheduler' && j.healthy !== true
    ).length
    const scheduler: SchedulerSummary = {
      requiredJobs,
      requiredExternalJobs,
      missingRequiredJobs,
      missingExternalJobs,
      warnings: schedulerWarnings({ hasEnabledWebhookEndpoints, missingExternalJobs, dependencies }),
      jobs: schedulerJobs,
    }
    const summary: AutomationSummary = {
      monitoredJobs: monitoredJobs.length,
      recentSuccess,
      stale,
      missingJobs,
      failedJobs,
      staleJobs,
      healthyJobs: schedulerJobs.filter((job) => job.state === 'healthy').length,
      externalJobs: schedulerJobs.filter((job) => job.state === 'external').length,
    }
    const healthStatus = deriveHealthStatus(summary, scheduler)

    return ok(
      {
        enabled: true,
        summary,
        healthStatus,
        scheduler,
      },
      undefined,
      bridge,
      requestId
    )
  } catch {
    const monitoredJobs = fallbackDeps.filter((d) => d.enabled).length
    const requiredJobs = fallbackDeps.filter((d) => d.enabled && d.required).length
    const requiredExternalJobs = fallbackDeps.filter((d) => d.enabled && d.required && d.wiring === 'external_scheduler').length
    const scheduler: SchedulerSummary = {
      requiredJobs,
      requiredExternalJobs,
      missingRequiredJobs: requiredJobs,
      missingExternalJobs: requiredExternalJobs,
      warnings: schedulerWarnings({
        hasEnabledWebhookEndpoints: false,
        missingExternalJobs: requiredExternalJobs,
        dependencies: fallbackDeps,
      }),
      jobs: fallbackDeps.map((d) => ({
        ...d,
        healthy: null,
        state: d.enabled ? (d.wiring === 'external_scheduler' ? 'external' : 'missing') : 'disabled',
      })),
    }
    const summary = summaryFallback(monitoredJobs)
    return ok(
      { enabled: false, summary, healthStatus: deriveHealthStatus(summary, scheduler), scheduler },
      undefined,
      bridge,
      requestId
    )
  }
})

