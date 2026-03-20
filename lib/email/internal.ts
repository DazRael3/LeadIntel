import { escapeHtml } from '@/lib/email/templates'

export type AdminNotificationEmail = { subject: string; html: string; text: string }

function mono(text: string): string {
  return `<pre style="white-space: pre-wrap; background:#0b1220; color:#e5e7eb; border:1px solid rgba(148,163,184,0.25); padding:14px; border-radius:10px;">${escapeHtml(
    text
  )}</pre>`
}

export function renderAdminNotificationEmail(args: {
  title: string
  lines: string[]
  appUrl: string
  ctaHref?: string
  ctaLabel?: string
}): AdminNotificationEmail {
  const subject = `LeadIntel · ${args.title}`
  const body = args.lines.join('\n')
  const ctaHref = args.ctaHref ? args.ctaHref : `${args.appUrl}/admin/ops`
  const ctaLabel = args.ctaLabel ? args.ctaLabel : 'Open ops'

  const text = [subject, '', body, '', `Open: ${ctaHref}`].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#050a14;color:#e5e7eb;font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
    <div style="max-width:640px;margin:0 auto;">
      <div style="font-size:12px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">LeadIntel operator notification</div>
      <h1 style="margin:10px 0 0 0;font-size:18px;color:#e5e7eb;">${escapeHtml(args.title)}</h1>
      <div style="margin-top:12px;">${mono(body)}</div>
      <div style="margin-top:14px;">
        <a href="${escapeHtml(ctaHref)}" style="display:inline-block; padding:10px 14px; border-radius:10px; text-decoration:none; font-weight:700; background:rgba(34,211,238,0.18); color:#67e8f9; border:1px solid rgba(34,211,238,0.35);">
          ${escapeHtml(ctaLabel)}
        </a>
      </div>
    </div>
  </body></html>`

  return { subject, html, text }
}

