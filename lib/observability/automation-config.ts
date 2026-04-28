import type { JobName } from '@/lib/jobs/types'

export type AutomationJobConfig = {
  job: JobName
  wiring: 'vercel_cron' | 'external_scheduler'
  enabled: boolean
  required: boolean
  reason: string
}

function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

function hasAnyValue(...keys: string[]): boolean {
  return keys.some((key) => (process.env[key] ?? '').trim().length > 0)
}

export function hasAnyCronSecret(): boolean {
  return hasAnyValue(
    'CRON_SECRET',
    'EXTERNAL_CRON_SECRET',
    'DIGEST_CRON_SECRET',
    'ACTIONS_QUEUE_CRON_SECRET',
    'SITE_REPORT_CRON_SECRET'
  )
}

export function getAutomationJobConfig(args: { hasEnabledWebhookEndpoints: boolean }): AutomationJobConfig[] {
  const lifecycleEnabled = flagEnabled(process.env.LIFECYCLE_EMAILS_ENABLED)
  const prospectEnabled = flagEnabled(process.env.PROSPECT_WATCH_ENABLED)
  const prospectDigestEnabled =
    flagEnabled(process.env.PROSPECT_WATCH_DAILY_DIGEST_ENABLED) ||
    flagEnabled(process.env.PROSPECT_WATCH_CONTENT_DIGEST_ENABLED)
  const siteReportsEnabled = flagEnabled(process.env.ENABLE_SITE_REPORTS)
  const coreCronEnabled = flagEnabled(process.env.ENABLE_CORE_CRON_AUTOMATION) || flagEnabled(process.env.CRON_AUTOMATION_ENABLED)

  return [
    {
      job: 'lifecycle',
      wiring: 'vercel_cron',
      enabled: lifecycleEnabled,
      required: lifecycleEnabled,
      reason: lifecycleEnabled ? 'enabled_by_lifecycle_emails' : 'disabled_lifecycle_emails_flag',
    },
    {
      job: 'digest_lite',
      wiring: 'vercel_cron',
      enabled: coreCronEnabled,
      required: coreCronEnabled,
      reason: coreCronEnabled ? 'enabled_core_cron_automation' : 'disabled_core_cron_automation_flag',
    },
    {
      job: 'kpi_monitor',
      wiring: 'vercel_cron',
      enabled: coreCronEnabled,
      required: coreCronEnabled,
      reason: coreCronEnabled ? 'enabled_core_cron_automation' : 'disabled_core_cron_automation_flag',
    },
    {
      job: 'content_audit',
      wiring: 'vercel_cron',
      enabled: siteReportsEnabled,
      required: siteReportsEnabled,
      reason: siteReportsEnabled ? 'enabled_site_reports' : 'disabled_site_reports_flag',
    },
    {
      job: 'growth_cycle',
      wiring: 'external_scheduler',
      enabled: prospectEnabled,
      required: prospectEnabled,
      reason: prospectEnabled ? 'enabled_prospect_watch' : 'disabled_prospect_watch_flag',
    },
    {
      job: 'sources_refresh',
      wiring: 'external_scheduler',
      enabled: prospectEnabled,
      required: prospectEnabled,
      reason: prospectEnabled ? 'enabled_prospect_watch' : 'disabled_prospect_watch_flag',
    },
    {
      job: 'prospect_watch',
      wiring: 'external_scheduler',
      enabled: prospectEnabled,
      required: prospectEnabled,
      reason: prospectEnabled ? 'enabled_prospect_watch' : 'disabled_prospect_watch_flag',
    },
    {
      job: 'prospect_watch_digest',
      wiring: 'external_scheduler',
      enabled: prospectEnabled && prospectDigestEnabled,
      required: prospectEnabled && prospectDigestEnabled,
      reason:
        prospectEnabled && prospectDigestEnabled
          ? 'enabled_prospect_watch_digest'
          : !prospectEnabled
            ? 'disabled_prospect_watch_flag'
            : 'disabled_prospect_digest_flags',
    },
    {
      job: 'webhook_deliveries',
      wiring: 'external_scheduler',
      enabled: args.hasEnabledWebhookEndpoints,
      required: args.hasEnabledWebhookEndpoints,
      reason: args.hasEnabledWebhookEndpoints ? 'enabled_webhook_endpoints_present' : 'disabled_no_enabled_webhook_endpoints',
    },
  ]
}
