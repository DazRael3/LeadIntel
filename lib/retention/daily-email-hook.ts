export type DailyEmailHook = {
  subject: string
  ctaLabel: 'View Leads'
  ctaHref: string
  previewLine: string
}

type BuildDailyEmailHookArgs = {
  newLeadsCount: number
  nicheLabel: string
}

/**
 * Builds copy/CTA structure for future daily re-engagement emails.
 * This is UI-safe metadata only and does not send email.
 */
export function buildDailyEmailHook(args: BuildDailyEmailHookArgs): DailyEmailHook {
  const safeCount = Number.isFinite(args.newLeadsCount) ? Math.max(0, Math.floor(args.newLeadsCount)) : 0
  const safeNiche = args.nicheLabel.trim().length > 0 ? args.nicheLabel.trim() : 'your workflow'

  return {
    subject: `${safeCount} new leads found today`,
    ctaLabel: 'View Leads',
    ctaHref: '/dashboard?tab=leads',
    previewLine: `New leads for ${safeNiche}`,
  }
}
