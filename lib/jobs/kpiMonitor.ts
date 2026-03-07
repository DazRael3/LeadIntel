import { serverEnv } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { queryHogQL, getPostHogApiConfig } from '@/lib/posthog/server'
import { sendEmailWithResend } from '@/lib/email/resend'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { runEnvDoctor } from '@/lib/ops/envDoctor'

type WindowKey = '24h' | '7d'

type Metric = {
  key: string
  event: string
}

const METRICS: Metric[] = [
  { key: 'landing_try_sample_submitted', event: 'landing_try_sample_submitted' },
  { key: 'landing_sample_generated', event: 'landing_sample_generated' },
  { key: 'cta_signup_clicked', event: 'cta_signup_clicked' },
  { key: 'signup_completed', event: 'signup_completed' },
  { key: 'activation_completed', event: 'activation_completed' },
  { key: 'upgrade_clicked', event: 'upgrade_clicked' },
]

function numEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function pctDrop(current: number, previous: number): number {
  if (previous <= 0) return 0
  return Math.round(((previous - current) / previous) * 1000) / 10
}

async function eventCount(args: { event: string; startIso: string; endIso: string }): Promise<number> {
  const cfg = getPostHogApiConfig()
  if (!cfg) throw new Error('posthog_not_configured')
  const q = `SELECT count() FROM events WHERE event = '${args.event.replace(/'/g, "''")}' AND timestamp >= toDateTime('${args.startIso}') AND timestamp < toDateTime('${args.endIso}')`
  return await queryHogQL({ config: cfg, query: q })
}

export async function runKpiMonitor(args: { dryRun?: boolean }) {
  const cfg = getPostHogApiConfig()
  if (!cfg) {
    const doctor = runEnvDoctor()
    const posthog = doctor.subsystems.find((s) => s.key === 'posthog')
    return {
      status: 'skipped' as const,
      summary: { reason: 'posthog_not_configured', missingKeys: posthog?.missingKeys ?? ['POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY'] },
    }
  }

  const to = (process.env.ALERT_EMAIL_TO ?? '').trim()
  const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean((serverEnv.RESEND_FROM_EMAIL ?? '').trim())
  if (!to) {
    return { status: 'skipped' as const, summary: { reason: 'alert_email_to_not_configured' } }
  }

  const dropPct24 = numEnv('ALERT_DROP_PCT_24H', 30)
  const dropPct7d = numEnv('ALERT_DROP_PCT_7D', 20)
  const min24 = numEnv('ALERT_MIN_COUNT_24H', 20)

  const now = new Date()
  const end = now.toISOString()
  const start24 = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const prevStart24 = new Date(now.getTime() - 48 * 3600 * 1000).toISOString()
  const prevEnd24 = start24

  const start7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const prevStart7d = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()
  const prevEnd7d = start7d

  const rows: Array<{
    metric: string
    window: WindowKey
    current: number
    previous: number
    dropPct: number
    alert: boolean
  }> = []

  try {
    for (const m of METRICS) {
      const [c24, p24, c7, p7] = await Promise.all([
        eventCount({ event: m.event, startIso: start24, endIso: end }),
        eventCount({ event: m.event, startIso: prevStart24, endIso: prevEnd24 }),
        eventCount({ event: m.event, startIso: start7d, endIso: end }),
        eventCount({ event: m.event, startIso: prevStart7d, endIso: prevEnd7d }),
      ])

      const d24 = pctDrop(c24, p24)
      const d7 = pctDrop(c7, p7)

      rows.push({
        metric: m.key,
        window: '24h',
        current: c24,
        previous: p24,
        dropPct: d24,
        alert: p24 >= min24 && d24 >= dropPct24,
      })
      rows.push({
        metric: m.key,
        window: '7d',
        current: c7,
        previous: p7,
        dropPct: d7,
        alert: d7 >= dropPct7d && p7 > 0,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    const m = /^posthog_query_failed_(\d+)$/.exec(message)
    if (m) {
      return {
        status: 'error' as const,
        summary: { error: `posthog_query_failed_${m[1]}`, host: cfg.host, projectId: cfg.projectId },
      }
    }
    return { status: 'error' as const, summary: { error: message, host: cfg.host, projectId: cfg.projectId } }
  }

  const alerts = rows.filter((r) => r.alert)

  // Persist triggered alerts (service-role only).
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    for (const a of alerts) {
      await supabase.from('growth_alerts').insert({
        metric: a.metric,
        window_key: a.window,
        current_count: a.current,
        previous_count: a.previous,
        drop_pct: a.dropPct,
        emailed_to: hasResend ? to : null,
        email_status: args.dryRun ? 'skipped' : hasResend ? 'sent' : 'skipped',
        details: {
          compared: a.window === '24h' ? { current: { start: start24, end }, previous: { start: prevStart24, end: prevEnd24 } } : { current: { start: start7d, end }, previous: { start: prevStart7d, end: prevEnd7d } },
        },
      })
    }
  } catch {
    // best-effort
  }

  if (alerts.length === 0) {
    return { status: 'ok' as const, summary: { alerts: 0, rows } }
  }

  if (!hasResend) {
    return { status: 'skipped' as const, summary: { reason: 'resend_not_configured', alerts: alerts.length, rows } }
  }

  if (args.dryRun) {
    return { status: 'skipped' as const, summary: { reason: 'dry_run', alerts: alerts.length, rows } }
  }

  // Send one email per triggered alert (clear subject).
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  for (const a of alerts) {
    const subj = `LeadIntel Growth Alert: ${a.metric} down ${a.dropPct}%`
    const body = [
      `Metric: ${a.metric}`,
      `Window: ${a.window} (current vs previous)`,
      `Current: ${a.current}`,
      `Previous: ${a.previous}`,
      `Drop: ${a.dropPct}%`,
      '',
      'Recommended checks:',
      '- Check /status and error rate',
      '- Review recent deploy diffs',
      '- Validate Try Sample flow',
      '- Check PostHog for referrer change',
    ].join('\n')

    await sendEmailWithResend({
      from,
      to,
      replyTo: SUPPORT_EMAIL,
      subject: subj,
      text: body,
      html: `<pre style="white-space:pre-wrap;font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
      tags: [{ name: 'kind', value: 'growth_alert' }, { name: 'metric', value: a.metric }, { name: 'window', value: a.window }],
    })
  }

  return { status: 'ok' as const, summary: { alerts: alerts.length, rows } }
}

