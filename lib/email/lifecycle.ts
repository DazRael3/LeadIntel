import { escapeHtml } from '@/lib/email/templates'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

export type LifecycleEmailType = 'welcome' | 'nudge_accounts' | 'nudge_pitch' | 'value_recap' | 'winback'

export type LifecycleEmail = {
  type: LifecycleEmailType
  subject: string
  html: string
  text: string
}

function monoBlock(text: string): string {
  return `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; background:#0b1220; color:#e5e7eb; border:1px solid rgba(34,211,238,0.25); padding:14px; border-radius:10px;">${escapeHtml(
    text
  )}</div>`
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:700; background:rgba(34,211,238,0.18); color:#67e8f9; border:1px solid rgba(34,211,238,0.35);">${escapeHtml(
    label
  )}</a>`
}

function link(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="color:#67e8f9; text-decoration:underline;">${escapeHtml(label)}</a>`
}

function footer(args: { appUrl: string }): { html: string; text: string } {
  const prefs = `${args.appUrl}/settings/notifications`
  const html = `<hr style="border:none;border-top:1px solid rgba(148,163,184,0.25); margin:20px 0;">
  <div style="font-size:12px; color:#94a3b8;">
    Manage email preferences: ${link(prefs, prefs)}<br>
    Support: <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#94a3b8;">${escapeHtml(SUPPORT_EMAIL)}</a>
  </div>`
  const text = `\n\nManage email preferences: ${prefs}\nSupport: ${SUPPORT_EMAIL}`
  return { html, text }
}

export function renderWelcomeEmail(args: { appUrl: string }): LifecycleEmail {
  const subject = 'Your signal engine is ready'
  const primaryHref = `${args.appUrl}/dashboard`
  const secondaryHref = `${args.appUrl}/how-scoring-works`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'Trigger-based account alerts and instant pitch drafts—built for outbound B2B SDRs/AEs.',
    '',
    'Next steps:',
    '- Define your ICP',
    '- Add 10 target accounts',
    '- Generate your first pitch draft',
    '',
    `Finish setup: ${primaryHref}`,
    `How scoring works: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:22px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:14px;font-size:14px;color:#cbd5e1;">
        Trigger-based account alerts and instant pitch drafts—built for outbound B2B SDRs/AEs.
      </div>
      <div style="margin-top:14px;">${monoBlock(`Next steps:\n1) Define your ICP\n2) Add 10 target accounts\n3) Generate your first pitch draft`)}</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Finish setup')}
        ${link(secondaryHref, 'How scoring works')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return { type: 'welcome', subject, html, text }
}

export function renderAccountsNudgeEmail(args: { appUrl: string }): LifecycleEmail {
  const subject = 'Add 10 accounts to unlock your first digest'
  const primaryHref = `${args.appUrl}/dashboard?onboarding=accounts`
  const secondaryHref = `${args.appUrl}/templates`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'Your target list becomes the daily shortlist.',
    '',
    'What you get:',
    '- Score accounts (0–100) with clear reasons',
    '- Spot trigger signals',
    '- Generate outreach drafts you can send immediately',
    '',
    `Add accounts: ${primaryHref}`,
    `Browse templates: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">Your target list becomes the daily shortlist.</div>
      <div style="margin-top:14px;">${monoBlock(`Outcomes:\n- Score accounts (0–100) with clear reasons\n- Spot trigger signals\n- Generate outreach drafts you can send immediately`)}</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Add accounts')}
        ${link(secondaryHref, 'Browse templates')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return { type: 'nudge_accounts', subject, html, text }
}

export function renderPitchNudgeEmail(args: { appUrl: string }): LifecycleEmail {
  const subject = 'Generate your first pitch draft'
  const primaryHref = `${args.appUrl}/dashboard?focus=pitch`
  const secondaryHref = `${args.appUrl}/tour`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'Pick one account. We’ll generate a short “why now” and a send-ready draft.',
    '',
    `Generate pitch: ${primaryHref}`,
    `Take a 2-minute tour: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">Pick one account. We’ll generate a short “why now” and a send-ready draft.</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Generate pitch')}
        ${link(secondaryHref, 'Take a 2-minute tour')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return { type: 'nudge_pitch', subject, html, text }
}

export function renderValueRecapEmail(args: {
  appUrl: string
  accountsCount: number
  pitchesCount: number
  savedOutputsCount: number
}): LifecycleEmail {
  const subject = 'Make this your daily workflow'
  const primaryHref = `${args.appUrl}/pricing?target=closer`
  const secondaryHref = `${args.appUrl}/dashboard`
  const footerBlock = footer({ appUrl: args.appUrl })

  const summary = `Accounts monitored: ${args.accountsCount}\nPitches generated: ${args.pitchesCount}\nSaved outputs: ${args.savedOutputsCount}`

  const text = [
    'You’re set up. The fastest wins come from timing.',
    '',
    summary,
    '',
    `Upgrade to Closer: ${primaryHref}`,
    `Open dashboard: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">You’re set up. The fastest wins come from timing.</div>
      <div style="margin-top:14px;">${monoBlock(summary)}</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Upgrade to Closer')}
        ${link(secondaryHref, 'Open dashboard')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return { type: 'value_recap', subject, html, text }
}

export function renderWinbackEmail(args: { appUrl: string }): LifecycleEmail {
  const subject = 'Want a sample digest for your target list?'
  const primaryHref = `${args.appUrl}/#try-sample`
  const secondaryHref = `${args.appUrl}/dashboard`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'If you want a faster start, reply with your ICP + 10 accounts and we’ll send a sample digest.',
    `Reply to: ${SUPPORT_EMAIL}`,
    '',
    `Generate a sample digest: ${primaryHref}`,
    `Finish setup: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">Reply with your ICP + 10 accounts and we’ll send a sample digest.</div>
      <div style="margin-top:10px;font-size:14px;color:#cbd5e1;">Support: <a href="mailto:${escapeHtml(
        SUPPORT_EMAIL
      )}" style="color:#67e8f9;">${escapeHtml(SUPPORT_EMAIL)}</a></div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Generate a sample digest')}
        ${link(secondaryHref, 'Finish setup')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return { type: 'winback', subject, html, text }
}

