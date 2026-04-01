import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { qaAllEmailTemplates } from '@/lib/email/qa'
import { getAppUrl } from '@/lib/app-url'

export type RecommendationSeverity = 'info' | 'warn' | 'error'

export type OpsRecommendation = {
  id: string
  severity: RecommendationSeverity
  title: string
  summary: string
  why: string[]
  actions: Array<{ label: string; href: string }>
  evidence?: Record<string, number | string | null>
}

export type LearningAgentReport = {
  generatedAt: string
  windowDays: number
  recommendations: OpsRecommendation[]
  metrics: Record<string, number | string | null>
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function safeCount(args: {
  table: string
  filter?: (q: ReturnType<ReturnType<typeof createSupabaseAdminClient>['from']>) => any
}): Promise<number | null> {
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    let q = admin.from(args.table).select('id', { count: 'exact', head: true })
    if (args.filter) q = args.filter(q)
    const res = await q
    return typeof res.count === 'number' ? res.count : 0
  } catch {
    return null
  }
}

export async function generateLearningAgentReport(args: { windowDays?: number }): Promise<LearningAgentReport> {
  const windowDays = typeof args.windowDays === 'number' && Number.isFinite(args.windowDays) ? Math.max(1, Math.min(30, Math.floor(args.windowDays))) : 7
  const since = isoDaysAgo(windowDays)
  const appUrl = getAppUrl()

  // Metrics (best-effort; null when admin DB is not configured).
  const [
    feedbackCount,
    assistantBlockedCount,
    sendReadyCount,
    prospectNewCount,
    emailFailedCount,
    emailQa,
  ] = await Promise.all([
    safeCount({ table: 'feedback', filter: (q) => q.gte('created_at', since) }),
    safeCount({
      table: 'product_analytics',
      filter: (q) => q.gte('created_at', since).eq('event_name', 'assistant_blocked'),
    }),
    safeCount({
      table: 'prospect_watch_outreach_drafts',
      filter: (q) => q.gte('updated_at', since).eq('send_ready', true),
    }),
    safeCount({
      table: 'prospect_watch_prospects',
      filter: (q) => q.gte('created_at', since).eq('status', 'new'),
    }),
    safeCount({
      table: 'email_send_log',
      filter: (q) => q.gte('created_at', since).eq('status', 'failed'),
    }),
    Promise.resolve(qaAllEmailTemplates({ appUrl })),
  ])

  const qaCounts = {
    ok: emailQa.filter((r) => r.severity === 'ok').length,
    warn: emailQa.filter((r) => r.severity === 'warn').length,
    error: emailQa.filter((r) => r.severity === 'error').length,
  }

  const recs: OpsRecommendation[] = []

  // Email QA
  if (qaCounts.error > 0) {
    recs.push({
      id: 'email_templates_error',
      severity: 'error',
      title: 'Email templates have QA errors',
      summary: 'At least one template is missing a required structural field (subject/html/text).',
      why: ['Broken email structure can cause poor deliverability and operator confusion.', 'Fix templates before enabling lifecycle sends broadly.'],
      actions: [{ label: 'Open Email Lab', href: '/admin/email' }],
      evidence: { qaErrors: qaCounts.error, qaWarnings: qaCounts.warn },
    })
  } else if (qaCounts.warn > 0) {
    recs.push({
      id: 'email_templates_warn',
      severity: 'warn',
      title: 'Email templates have QA warnings',
      summary: 'Some templates are missing a clear CTA/prefs link/support mailto, or have mobile readability risks.',
      why: ['Warnings don’t block sending, but they correlate with lower trust and weaker activation/conversion.'],
      actions: [{ label: 'Open Email Lab', href: '/admin/email' }],
      evidence: { qaWarnings: qaCounts.warn },
    })
  }

  // Assistant friction
  if (typeof assistantBlockedCount === 'number' && assistantBlockedCount > 0) {
    recs.push({
      id: 'assistant_blocked',
      severity: assistantBlockedCount >= 10 ? 'warn' : 'info',
      title: 'Users are hitting Assistant entitlement blocks',
      summary: 'Assistant requests are being blocked (plan/workspace/auth/permissions/temporary).',
      why: ['This usually indicates users are discovering Assistant before they’re eligible.', 'Consider adding clearer gating copy or a guided alternative path.'],
      actions: [{ label: 'Review Assistant settings', href: '/settings/assistant' }, { label: 'View pricing', href: '/pricing' }],
      evidence: { assistantBlockedEvents: assistantBlockedCount, windowDays },
    })
  }

  // Prospect workflow throughput
  if (typeof sendReadyCount === 'number' && sendReadyCount > 0) {
    recs.push({
      id: 'send_ready_throughput',
      severity: sendReadyCount >= 5 ? 'info' : 'info',
      title: 'Send-ready outreach drafts available',
      summary: 'There are send-ready outreach drafts awaiting operator action.',
      why: ['Send-ready indicates contact + recipient review completed.', 'If these aren’t acted on, value is bottlenecked in the approval step.'],
      actions: [{ label: 'Open prospect queue', href: '/settings/prospects' }],
      evidence: { sendReadyDrafts: sendReadyCount, windowDays },
    })
  }
  if (typeof prospectNewCount === 'number' && prospectNewCount > 0) {
    recs.push({
      id: 'prospects_new',
      severity: prospectNewCount >= 10 ? 'warn' : 'info',
      title: 'Prospects awaiting review',
      summary: 'New prospects are queued for review.',
      why: ['Review-first workflow requires operator attention to convert signals into action.', 'If this grows, consider adjusting feed sources or scoring thresholds.'],
      actions: [{ label: 'Open prospect queue', href: '/settings/prospects' }],
      evidence: { prospectsNew: prospectNewCount, windowDays },
    })
  }

  // Email send failures
  if (typeof emailFailedCount === 'number' && emailFailedCount > 0) {
    recs.push({
      id: 'email_send_failures',
      severity: emailFailedCount >= 3 ? 'warn' : 'info',
      title: 'Email send failures detected',
      summary: 'Some email sends failed in the last window.',
      why: ['Review Resend configuration and sender domain health.', 'Use Email Lab test-send to validate From/Reply-To and deliverability.'],
      actions: [{ label: 'Open Ops', href: '/admin/ops' }, { label: 'Open Email Lab', href: '/admin/email' }],
      evidence: { emailSendFailures: emailFailedCount, windowDays },
    })
  }

  // Feedback intake
  if (typeof feedbackCount === 'number' && feedbackCount > 0) {
    recs.push({
      id: 'feedback_recent',
      severity: feedbackCount >= 5 ? 'info' : 'info',
      title: 'Recent feedback submitted',
      summary: 'Users submitted feedback recently; review themes and follow up where needed.',
      why: ['Feedback is the highest-signal friction detector when kept privacy-safe and lightweight.'],
      actions: [{ label: 'Open support tools', href: '/admin/support' }],
      evidence: { feedbackCount, windowDays },
    })
  }

  const metrics: LearningAgentReport['metrics'] = {
    feedbackCount,
    assistantBlockedCount,
    sendReadyCount,
    prospectNewCount,
    emailFailedCount,
    emailQaWarnings: qaCounts.warn,
    emailQaErrors: qaCounts.error,
  }

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    recommendations: recs,
    metrics,
  }
}

