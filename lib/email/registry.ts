import { renderAdminNotificationEmail } from '@/lib/email/internal'
import {
  renderAccountsNudgeEmail,
  renderFeedbackRequestEmail,
  renderFirstOutputEmail,
  renderPitchNudgeEmail,
  renderStarterExhaustedEmail,
  renderStarterNearLimitEmail,
  renderSupportHelpEmail,
  renderUpgradeConfirmationEmail,
  renderValueRecapEmail,
  renderWelcomeEmail,
  renderWinbackEmail,
  type LifecycleEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'

export type EmailTemplateKind = 'lifecycle' | 'internal' | 'prospect_watch'

export type EmailTemplateId =
  | `lifecycle.${LifecycleEmailType}`
  | 'prospect_watch.daily_digest'
  | 'prospect_watch.high_priority'
  | 'internal.admin_notification'

export type EmailTemplateMeta = {
  id: EmailTemplateId
  kind: EmailTemplateKind
  label: string
  purpose: string
  audience: 'user' | 'operator'
  trigger: string
  lastUpdated: string
  requiresResend: boolean
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
  // Used by send/dedupe tracking.
  templateName: string
  kind: EmailTemplateKind
}

export type EmailTemplateRegistryEntry = {
  meta: EmailTemplateMeta
  render: (args: { appUrl: string }) => RenderedEmail
  sampleArgs?: { appUrl: string }
}

function lifecycle(
  type: LifecycleEmailType,
  label: string,
  purpose: string,
  trigger: string,
  lastUpdated: string,
  renderFn: (args: { appUrl: string }) => LifecycleEmail
): EmailTemplateRegistryEntry {
  return {
    meta: {
      id: `lifecycle.${type}`,
      kind: 'lifecycle',
      label,
      purpose,
      audience: 'user',
      trigger,
      lastUpdated,
      requiresResend: true,
    },
    render: ({ appUrl }) => {
      const out = renderFn({ appUrl })
      return { subject: out.subject, html: out.html, text: out.text, templateName: type, kind: 'lifecycle' }
    },
    sampleArgs: { appUrl: 'https://raelinfo.com' },
  }
}

export const EMAIL_TEMPLATES: EmailTemplateRegistryEntry[] = [
  lifecycle(
    'welcome',
    'Welcome',
    'Confirm setup and guide first steps.',
    'New signup / first lifecycle touch.',
    '2026-03-25',
    renderWelcomeEmail
  ),
  lifecycle(
    'nudge_accounts',
    'Accounts nudge',
    'Prompt user to add accounts to unlock digest value.',
    'User has not added enough accounts after signup.',
    '2026-03-25',
    renderAccountsNudgeEmail
  ),
  lifecycle(
    'nudge_pitch',
    'Pitch nudge',
    'Prompt user to generate first pitch draft.',
    'User is setup-light but hasn’t generated a pitch.',
    '2026-03-25',
    renderPitchNudgeEmail
  ),
  lifecycle(
    'first_output',
    'First output',
    'Reinforce first value and suggest next step.',
    'First successful output generated.',
    '2026-03-25',
    renderFirstOutputEmail
  ),
  lifecycle(
    'starter_near_limit',
    'Starter near limit',
    'Warn near Starter cap with clear upgrade path.',
    'Starter preview remaining is low.',
    '2026-03-25',
    renderStarterNearLimitEmail as unknown as (args: { appUrl: string }) => LifecycleEmail
  ),
  lifecycle(
    'starter_exhausted',
    'Starter exhausted',
    'Explain limit reached and next best action.',
    'Starter preview cap reached.',
    '2026-03-25',
    renderStarterExhaustedEmail
  ),
  lifecycle(
    'feedback_request',
    'Feedback request',
    'Ask what blocked value to reduce friction.',
    'After early usage window or stall.',
    '2026-03-25',
    renderFeedbackRequestEmail
  ),
  lifecycle(
    'upgrade_confirmation',
    'Upgrade confirmation',
    'Confirm upgrade and clarify what changed.',
    'Stripe upgrade event.',
    '2026-03-25',
    renderUpgradeConfirmationEmail
  ),
  lifecycle(
    'support_help',
    'Support help',
    'Offer help getting to first value.',
    'Manual or automated support help trigger.',
    '2026-03-25',
    renderSupportHelpEmail
  ),
  lifecycle(
    'value_recap',
    'Value recap',
    'Summarize progress and suggest daily workflow.',
    'After meaningful setup/use window.',
    '2026-03-25',
    renderValueRecapEmail as unknown as (args: { appUrl: string }) => LifecycleEmail
  ),
  lifecycle(
    'winback',
    'Winback',
    'Offer a low-friction sample digest to restart engagement.',
    'After inactivity window.',
    '2026-03-25',
    renderWinbackEmail
  ),
  {
    meta: {
      id: 'internal.admin_notification',
      kind: 'internal',
      label: 'Operator notification',
      purpose: 'Internal operator alert/digest wrapper email.',
      audience: 'operator',
      trigger: 'Admin notifications, digests, alerts.',
      lastUpdated: '2026-03-25',
      requiresResend: true,
    },
    render: ({ appUrl }) => {
      const out = renderAdminNotificationEmail({
        title: 'Template preview',
        lines: ['This is an internal operator notification template preview.'],
        appUrl,
        ctaHref: `${appUrl}/admin/ops`,
        ctaLabel: 'Open ops',
      })
      return { subject: out.subject, html: out.html, text: out.text, templateName: 'internal_admin_notification', kind: 'internal' }
    },
    sampleArgs: { appUrl: 'https://raelinfo.com' },
  },
  {
    meta: {
      id: 'prospect_watch.daily_digest',
      kind: 'prospect_watch',
      label: 'Prospect watch daily digest',
      purpose: 'Founder/operator digest for prospects/content drafts awaiting review.',
      audience: 'operator',
      trigger: 'Prospect watch digest job.',
      lastUpdated: '2026-03-25',
      requiresResend: true,
    },
    render: ({ appUrl }) => {
      const out = renderAdminNotificationEmail({
        title: 'Prospect watch digest (preview)',
        lines: ['Prospects awaiting review: 3', 'Content drafts awaiting review: 2', 'Send-ready outreach drafts: 1'],
        appUrl,
        ctaHref: `${appUrl}/settings/prospects`,
        ctaLabel: 'Open prospect queue',
      })
      return { subject: out.subject, html: out.html, text: out.text, templateName: 'prospect_watch_daily_digest', kind: 'prospect_watch' }
    },
    sampleArgs: { appUrl: 'https://raelinfo.com' },
  },
  {
    meta: {
      id: 'prospect_watch.high_priority',
      kind: 'prospect_watch',
      label: 'Prospect watch high-priority alert',
      purpose: 'Notify operator when a high-priority signal is detected.',
      audience: 'operator',
      trigger: 'Prospect watch run produces high-priority items.',
      lastUpdated: '2026-03-25',
      requiresResend: true,
    },
    render: ({ appUrl }) => {
      const out = renderAdminNotificationEmail({
        title: 'High-priority prospect (preview)',
        lines: ['Company: ExampleCo', 'Signal: funding', 'Score: 92/100', 'Next: review recipient + draft'],
        appUrl,
        ctaHref: `${appUrl}/settings/prospects`,
        ctaLabel: 'Review prospect',
      })
      return { subject: out.subject, html: out.html, text: out.text, templateName: 'prospect_watch_high_priority', kind: 'prospect_watch' }
    },
    sampleArgs: { appUrl: 'https://raelinfo.com' },
  },
]

export function getEmailTemplate(id: EmailTemplateId): EmailTemplateRegistryEntry | null {
  return EMAIL_TEMPLATES.find((t) => t.meta.id === id) ?? null
}

export function isEmailTemplateId(v: string): v is EmailTemplateId {
  return EMAIL_TEMPLATES.some((t) => t.meta.id === v)
}

export function listEmailTemplates(): Array<{ id: EmailTemplateId; meta: EmailTemplateMeta }> {
  return EMAIL_TEMPLATES.map((t) => ({ id: t.meta.id, meta: t.meta }))
}

