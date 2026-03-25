import { EMAIL_TEMPLATES, type EmailTemplateId, type RenderedEmail, type EmailTemplateMeta } from '@/lib/email/registry'

export type EmailQaIssueCode =
  | 'missing_subject'
  | 'short_subject'
  | 'missing_html'
  | 'missing_text'
  | 'missing_cta'
  | 'missing_prefs_link'
  | 'missing_support_mailto'
  | 'suspicious_claim'
  | 'long_lines_text'

export type EmailQaIssue = {
  code: EmailQaIssueCode
  message: string
}

export type EmailQaResult = {
  templateId: EmailTemplateId
  meta: EmailTemplateMeta
  issues: EmailQaIssue[]
  severity: 'ok' | 'warn' | 'error'
}

function includesAny(hay: string, needles: string[]): boolean {
  const h = hay.toLowerCase()
  return needles.some((n) => h.includes(n.toLowerCase()))
}

function hasCta(rendered: RenderedEmail): boolean {
  const html = rendered.html || ''
  const text = rendered.text || ''
  // Very lightweight: detect at least one obvious link/CTA.
  return (
    html.includes('<a ') ||
    includesAny(text, ['http://', 'https://', '/dashboard', '/pricing', '/support', 'mailto:'])
  )
}

function hasPrefsLink(rendered: RenderedEmail): boolean {
  const html = rendered.html || ''
  const text = rendered.text || ''
  return includesAny(html + '\n' + text, ['/settings/notifications', 'email preferences'])
}

function hasSupportMailto(rendered: RenderedEmail): boolean {
  const html = rendered.html || ''
  const text = rendered.text || ''
  return includesAny(html + '\n' + text, ['mailto:'])
}

function hasSuspiciousClaims(rendered: RenderedEmail): boolean {
  const combined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`.toLowerCase()
  // Guardrail words that often indicate overclaiming. This is intentionally conservative.
  return includesAny(combined, ['guarantee', 'guaranteed', 'we promise', '100%'])
}

function textHasLongLines(text: string): boolean {
  const lines = text.split('\n')
  return lines.some((l) => l.length >= 220)
}

export function qaEmailTemplate(args: {
  templateId: EmailTemplateId
  rendered: RenderedEmail
}): EmailQaIssue[] {
  const issues: EmailQaIssue[] = []
  const subject = (args.rendered.subject ?? '').trim()
  if (!subject) issues.push({ code: 'missing_subject', message: 'Missing subject' })
  if (subject && subject.length < 8) issues.push({ code: 'short_subject', message: 'Subject looks too short' })

  const html = (args.rendered.html ?? '').trim()
  const text = (args.rendered.text ?? '').trim()
  if (!html) issues.push({ code: 'missing_html', message: 'Missing HTML body' })
  if (!text) issues.push({ code: 'missing_text', message: 'Missing text body' })

  if (!hasCta(args.rendered)) issues.push({ code: 'missing_cta', message: 'No obvious CTA/link detected' })
  if (!hasPrefsLink(args.rendered)) issues.push({ code: 'missing_prefs_link', message: 'Missing email preferences link (/settings/notifications)' })
  if (!hasSupportMailto(args.rendered)) issues.push({ code: 'missing_support_mailto', message: 'Missing support mailto link' })
  if (hasSuspiciousClaims(args.rendered)) issues.push({ code: 'suspicious_claim', message: 'Contains potentially overconfident claims (check wording)' })
  if (text && textHasLongLines(text)) issues.push({ code: 'long_lines_text', message: 'Plain-text has very long lines (may be hard on mobile/email clients)' })

  return issues
}

export function qaAllEmailTemplates(args: { appUrl: string }): EmailQaResult[] {
  const results: EmailQaResult[] = []
  for (const t of EMAIL_TEMPLATES) {
    const rendered = t.render({ appUrl: args.appUrl })
    const issues = qaEmailTemplate({ templateId: t.meta.id, rendered })
    const hasError = issues.some((i) => i.code === 'missing_subject' || i.code === 'missing_html' || i.code === 'missing_text')
    const severity: EmailQaResult['severity'] = hasError ? 'error' : issues.length > 0 ? 'warn' : 'ok'
    results.push({ templateId: t.meta.id, meta: t.meta, issues, severity })
  }
  return results
}

