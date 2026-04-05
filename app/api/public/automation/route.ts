import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

type AutomationSummary = {
  monitoredJobs: number
  recentSuccess: boolean
  stale: boolean
  missingJobs: number
  failedJobs: number
  staleJobs: number
}

type SchedulerDependency = {
  job: JobName
  wiring: 'vercel_cron' | 'external_scheduler'
  required: boolean
  enabled: boolean
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
  }>
}

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

function hasAnyCronSecret(): boolean {
  const cron = (process.env.CRON_SECRET ?? '').trim()
  const ext = (process.env.EXTERNAL_CRON_SECRET ?? '').trim()
  return cron.length > 0 || ext.length > 0
}

function parseCsv(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function buildSchedulerDependencies(args: { hasEnabledWebhookEndpoints: boolean }): SchedulerDependency[] {
  const lifecycleEnabled = flagEnabled(process.env.LIFECYCLE_EMAILS_ENABLED)
  const prospectEnabled = flagEnabled(process.env.PROSPECT_WATCH_ENABLED)
  const prospectDigestEnabled =
    flagEnabled(process.env.PROSPECT_WATCH_DAILY_DIGEST_ENABLED) || flagEnabled(process.env.PROSPECT_WATCH_CONTENT_DIGEST_ENABLED)

  const deps: SchedulerDependency[] = [
    { job: 'lifecycle', wiring: 'vercel_cron', required: true, enabled: true },
    { job: 'digest_lite', wiring: 'vercel_cron', required: true, enabled: true },
    { job: 'kpi_monitor', wiring: 'vercel_cron', required: true, enabled: true },
    { job: 'content_audit', wiring: 'vercel_cron', required: true, enabled: true },
    // External schedules that must be explicitly wired if those automations are relied on.
    { job: 'growth_cycle', wiring: 'external_scheduler', required: true, enabled: true },
    { job: 'sources_refresh', wiring: 'external_scheduler', required: true, enabled: true },
    { job: 'prospect_watch', wiring: 'external_scheduler', required: prospectEnabled, enabled: prospectEnabled },
    {
      job: 'prospect_watch_digest',
      wiring: 'external_scheduler',
      required: prospectEnabled && prospectDigestEnabled,
      enabled: prospectEnabled && prospectDigestEnabled,
    },
    {
      job: 'webhook_deliveries',
      wiring: 'external_scheduler',
      required: args.hasEnabledWebhookEndpoints,
      enabled: args.hasEnabledWebhookEndpoints,
    },
  ]

  if (!lifecycleEnabled) {
    // lifecycle scheduling still runs for non-email lifecycle bookkeeping, so keep enabled=true.
    // no-op
  }
  return deps
}

function schedulerWarnings(args: { hasEnabledWebhookEndpoints: boolean; missingExternalJobs: number }): string[] {
  const warnings: string[] = []
  const lifecycleEnabled = flagEnabled(process.env.LIFECYCLE_EMAILS_ENABLED)
  const resendConfigured = Boolean((process.env.RESEND_API_KEY ?? '').trim()) && Boolean((process.env.RESEND_FROM_EMAIL ?? '').trim())
  const prospectEnabled = flagEnabled(process.env.PROSPECT_WATCH_ENABLED)
  const rssFeedsConfigured = parseCsv(process.env.PROSPECT_WATCH_RSS_FEEDS).length > 0
  const reviewEmailsConfigured = parseCsv(process.env.PROSPECT_WATCH_REVIEW_EMAILS).length > 0

  if (!hasAnyCronSecret()) {
    warnings.push('Cron secrets are not configured; scheduler routes cannot be authenticated safely.')
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
  }
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
      warnings: schedulerWarnings({ hasEnabledWebhookEndpoints: false, missingExternalJobs: requiredExternalJobs }),
      jobs: fallbackDeps.map((d) => ({ ...d, healthy: null })),
    }
    return ok(
      { enabled: false, summary: summaryFallback(fallbackDeps.filter((d) => d.enabled).length), scheduler },
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

    const missingJobs = checks.filter((c) => !c.hasRun).length
    const failedJobs = checks.filter((c) => c.hasRun && !c.success).length
    const staleJobs = checks.filter((c) => c.stale).length
    const recentSuccess = checks.every((c) => c.hasRun && c.success)
    const stale = staleJobs > 0
    const schedulerJobs = dependencies.map((dep) => {
      const check = checkByJob.get(dep.job)
      const healthy = !dep.enabled ? null : check ? check.hasRun && check.success && !check.stale : false
      return {
        job: dep.job,
        wiring: dep.wiring,
        required: dep.required,
        enabled: dep.enabled,
        healthy,
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
      warnings: schedulerWarnings({ hasEnabledWebhookEndpoints, missingExternalJobs }),
      jobs: schedulerJobs,
    }

    return ok(
      {
        enabled: true,
        summary: {
          monitoredJobs: monitoredJobs.length,
          recentSuccess,
          stale,
          missingJobs,
          failedJobs,
          staleJobs,
        },
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
      warnings: schedulerWarnings({ hasEnabledWebhookEndpoints: false, missingExternalJobs: requiredExternalJobs }),
      jobs: fallbackDeps.map((d) => ({ ...d, healthy: null })),
    }
    return ok({ enabled: false, summary: summaryFallback(monitoredJobs), scheduler }, undefined, bridge, requestId)
  }
})

