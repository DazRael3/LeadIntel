import { escapeHtml } from '@/lib/email/templates'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { serverEnv } from '@/lib/env'

export type LifecycleEmailType =
  | 'welcome'
  | 'nudge_accounts'
  | 'nudge_pitch'
  | 'first_output'
  | 'starter_near_limit'
  | 'starter_exhausted'
  | 'feedback_request'
  | 'upgrade_confirmation'
  | 'support_help'
  | 'value_recap'
  | 'winback'

export type LifecycleEmail = {
  type: LifecycleEmailType
  subject: string
  html: string
  text: string
}

type LifecycleRenderArgs = {
  appUrl: string
  variantSeed?: string
}

function stableVariantIndex(seed: string | undefined, count: number): number {
  if (count <= 1) return 0
  const input = (seed ?? '').trim()
  if (!input) return 0
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return Math.abs(hash >>> 0) % count
}

function pickVariant(seed: string | undefined, values: readonly string[]): string {
  return values[stableVariantIndex(seed, values.length)] ?? values[0] ?? ''
}

function getLogoUrl(): string | null {
  const raw = (serverEnv.EMAIL_BRAND_IMAGE_URL ?? '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

const DEFAULT_HEADER_HTML =
  '<div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>'
const FOOTER_MARKER = '<hr style="border:none;border-top:1px solid rgba(148,163,184,0.25); margin:20px 0;">'

const VARIANT_LINES: Record<LifecycleEmailType, readonly string[]> = {
  welcome: [
    'You can start simple and still get signal quickly.',
    'Small daily consistency usually beats one-time setup bursts.',
    'We kept this workflow short so you can see value fast.',
  ],
  nudge_accounts: [
    'A focused account list makes every alert more useful.',
    'Quality targets outperform large unfocused lists.',
    'Ten clear targets are enough to start strong.',
  ],
  nudge_pitch: [
    'A first draft is the fastest way to calibrate your messaging.',
    'One real draft gives you signal faster than planning alone.',
    'Use the first draft to quickly iterate your angle.',
  ],
  first_output: [
    'Keep momentum while this account context is fresh.',
    'The second output is usually faster than the first.',
    'Saving one winning angle compounds over time.',
  ],
  starter_near_limit: [
    'Use the remaining previews on your highest-intent accounts.',
    'Prioritize accounts with clear trigger activity first.',
    'A focused final preview often reveals your best workflow.',
  ],
  starter_exhausted: [
    'You’ve validated the flow; now it’s about consistent execution.',
    'This is a good point to decide if the workflow fits your team.',
    'If the signal quality is working, ongoing usage is the next step.',
  ],
  feedback_request: [
    'Your feedback helps us reduce friction for real operators.',
    'Short, specific feedback is the most useful for product tuning.',
    'Even one blocker note helps us improve the next run.',
  ],
  upgrade_confirmation: [
    'Thanks for investing in a more consistent outbound workflow.',
    'You now have room to run this process without preview limits.',
    'This unlocks continuous use instead of one-off testing.',
  ],
  support_help: [
    'We can help you get from setup to first win quickly.',
    'A short support exchange can remove most early blockers.',
    'You do not need a long onboarding to get useful output.',
  ],
  value_recap: [
    'Repeatable timing beats one-off outreach bursts.',
    'Small daily review loops compound into better pipeline quality.',
    'Operational consistency is where this workflow performs best.',
  ],
  winback: [
    'If priorities changed, we can still help you restart quickly.',
    'A quick sample can help validate fit without extra setup.',
    'If timing matters now, we can help you re-enter the flow fast.',
  ],
}

function renderEmailHeader(args: { appUrl: string }): string {
  const logoUrl = getLogoUrl()
  const appUrl = escapeHtml(args.appUrl)
  return logoUrl
    ? `<div style="margin-bottom:10px;">
        <a href="${appUrl}" style="text-decoration:none;">
          <img src="${escapeHtml(logoUrl)}" alt="LeadIntel logo" style="max-width:190px;height:auto;border:0;display:block;">
        </a>
      </div>`
    : DEFAULT_HEADER_HTML
}

function applyBrandingAndVariation(
  email: LifecycleEmail,
  args: LifecycleRenderArgs
): LifecycleEmail {
  const seed = args.variantSeed ? `${email.type}:${args.variantSeed}` : email.type
  const variantLine = pickVariant(seed, VARIANT_LINES[email.type])

  const htmlWithLogo = email.html.replace(DEFAULT_HEADER_HTML, renderEmailHeader({ appUrl: args.appUrl }))
  const htmlWithVariant = htmlWithLogo.includes(FOOTER_MARKER)
    ? htmlWithLogo.replace(
        FOOTER_MARKER,
        `<div style="margin-top:12px;font-size:13px;color:#cbd5e1;">${escapeHtml(variantLine)}</div>${FOOTER_MARKER}`
      )
    : htmlWithLogo
  const textWithVariant = `${email.text}\n\n${variantLine}`

  return {
    ...email,
    html: htmlWithVariant,
    text: textWithVariant,
  }
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

export function renderWelcomeEmail(args: LifecycleRenderArgs): LifecycleEmail {
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

  return applyBrandingAndVariation({ type: 'welcome', subject, html, text }, args)
}

export function renderAccountsNudgeEmail(args: LifecycleRenderArgs): LifecycleEmail {
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

  return applyBrandingAndVariation({ type: 'nudge_accounts', subject, html, text }, args)
}

export function renderPitchNudgeEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Generate your first pitch draft'
  const primaryHref = `${args.appUrl}/pitch`
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

  return applyBrandingAndVariation({ type: 'nudge_pitch', subject, html, text }, args)
}

export function renderValueRecapEmail(args: {
  appUrl: string
  accountsCount: number
  pitchesCount: number
  savedOutputsCount: number
  variantSeed?: string
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

  return applyBrandingAndVariation(
    { type: 'value_recap', subject, html, text },
    { appUrl: args.appUrl, variantSeed: args.variantSeed }
  )
}

export function renderWinbackEmail(args: LifecycleRenderArgs): LifecycleEmail {
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

  return applyBrandingAndVariation({ type: 'winback', subject, html, text }, args)
}

export function renderFirstOutputEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Nice — your first output is ready'
  const primaryHref = `${args.appUrl}/dashboard`
  const secondaryHref = `${args.appUrl}/pricing?target=closer`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'You just generated your first LeadIntel output.',
    '',
    'Next best step:',
    '- Save one winning angle',
    '- Add a few more target accounts',
    '- Generate another draft while the timing is fresh',
    '',
    'Starter is limited so you can prove the workflow quickly. Upgrade to Closer when you’re ready for ongoing usage.',
    '',
    `Open dashboard: ${primaryHref}`,
    `See Closer: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">You just generated your first LeadIntel output.</div>
      <div style="margin-top:14px;">${monoBlock(
        `Next best step:\n- Save one winning angle\n- Add a few more target accounts\n- Generate another draft while the timing is fresh`
      )}</div>
      <div style="margin-top:12px;font-size:13px;color:#cbd5e1;">
        Starter is limited so you can prove the workflow quickly. Upgrade to Closer when you’re ready for ongoing usage.
      </div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Open dashboard')}
        ${link(secondaryHref, 'See Closer')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation({ type: 'first_output', subject, html, text }, args)
}

export function renderStarterNearLimitEmail(args: { appUrl: string; remaining: number; variantSeed?: string }): LifecycleEmail {
  const subject = 'Heads up: you’re close to the Starter limit'
  const primaryHref = `${args.appUrl}/pricing?target=closer`
  const secondaryHref = `${args.appUrl}/dashboard`
  const footerBlock = footer({ appUrl: args.appUrl })

  const remainingLabel = Number.isFinite(args.remaining) ? String(args.remaining) : 'a few'

  const text = [
    `You have ${remainingLabel} Starter preview generation${args.remaining === 1 ? '' : 's'} left.`,
    '',
    'Starter is intentionally limited so you can prove the workflow quickly.',
    'Upgrade to Closer to keep going with unlimited usage.',
    '',
    `Upgrade: ${primaryHref}`,
    `Open dashboard: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">You have <strong>${escapeHtml(remainingLabel)}</strong> Starter preview generation${args.remaining === 1 ? '' : 's'} left.</div>
      <div style="margin-top:14px;font-size:13px;color:#cbd5e1;">
        Starter is intentionally limited so you can prove the workflow quickly. Upgrade to Closer to keep going with unlimited usage.
      </div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Upgrade to Closer')}
        ${link(secondaryHref, 'Open dashboard')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation(
    { type: 'starter_near_limit', subject, html, text },
    { appUrl: args.appUrl, variantSeed: args.variantSeed }
  )
}

export function renderStarterExhaustedEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Starter limit reached'
  const primaryHref = `${args.appUrl}/pricing?target=closer`
  const secondaryHref = `${args.appUrl}/pricing`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'You’ve used all Starter preview generations.',
    '',
    'Upgrade to Closer to continue with unlimited usage, plus the full workflow without preview limits.',
    '',
    `Upgrade to Closer: ${primaryHref}`,
    `See pricing: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">You’ve used all Starter preview generations.</div>
      <div style="margin-top:14px;font-size:13px;color:#cbd5e1;">
        Upgrade to Closer to continue with unlimited usage, plus the full workflow without preview limits.
      </div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Upgrade to Closer')}
        ${link(secondaryHref, 'See pricing')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation({ type: 'starter_exhausted', subject, html, text }, args)
}

export function renderFeedbackRequestEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Quick question — what blocked you?'
  const primaryHref = `${args.appUrl}/support`
  const secondaryHref = `${args.appUrl}/dashboard`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'If you have 20 seconds: what was the hardest part of getting value from LeadIntel?',
    '',
    'Reply to this email or use the in-app feedback card.',
    '',
    `Support: ${primaryHref}`,
    `Open dashboard: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">
        If you have 20 seconds: what was the hardest part of getting value from LeadIntel?
      </div>
      <div style="margin-top:12px;font-size:13px;color:#cbd5e1;">
        Reply to this email or use the in-app feedback card. It helps us reduce friction without adding noise.
      </div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Get support')}
        ${link(secondaryHref, 'Open dashboard')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation({ type: 'feedback_request', subject, html, text }, args)
}

export function renderUpgradeConfirmationEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Upgrade confirmed — Closer is active'
  const primaryHref = `${args.appUrl}/dashboard`
  const secondaryHref = `${args.appUrl}/settings/notifications`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'Thanks — your upgrade is active.',
    '',
    'What changed:',
    '- Unlimited usage (no Starter preview cap)',
    '- Full workflow access where previously preview/locked',
    '',
    `Open dashboard: ${primaryHref}`,
    `Email preferences: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">Thanks — your upgrade is active.</div>
      <div style="margin-top:14px;">${monoBlock(`What changed:\n- Unlimited usage (no Starter preview cap)\n- Full workflow access where previously preview/locked`)}</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Open dashboard')}
        ${link(secondaryHref, 'Email preferences')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation({ type: 'upgrade_confirmation', subject, html, text }, args)
}

export function renderSupportHelpEmail(args: LifecycleRenderArgs): LifecycleEmail {
  const subject = 'Need help getting to first value?'
  const primaryHref = `${args.appUrl}/support`
  const secondaryHref = `${args.appUrl}/dashboard`
  const footerBlock = footer({ appUrl: args.appUrl })

  const text = [
    'If anything felt confusing, we can help you get to first value quickly.',
    '',
    'Reply to this email with:',
    '- what you sell',
    '- your ideal customer',
    '- 10 target accounts',
    '',
    `Support: ${primaryHref}`,
    `Open dashboard: ${secondaryHref}`,
    footerBlock.text,
  ].join('\n')

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:14px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel</div>
      <h1 style="margin:10px 0 0 0;font-size:20px;color:#e5e7eb;">${escapeHtml(subject)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#cbd5e1;">If anything felt confusing, we can help you get to first value quickly.</div>
      <div style="margin-top:14px;">${monoBlock(`Reply with:\n- what you sell\n- your ideal customer\n- 10 target accounts`)}</div>
      <div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">
        ${button(primaryHref, 'Get support')}
        ${link(secondaryHref, 'Open dashboard')}
      </div>
      ${footerBlock.html}
    </div>
  </body></html>`

  return applyBrandingAndVariation({ type: 'support_help', subject, html, text }, args)
}

