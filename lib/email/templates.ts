export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderSimplePitchEmailHtml(args: {
  brandName: string
  recipientName?: string
  senderName: string
  pitchText: string
  footerText?: string
}): string {
  const recipient = escapeHtml(args.recipientName || 'there')
  const sender = escapeHtml(args.senderName)
  const brand = escapeHtml(args.brandName)

  const paragraphs = args.pitchText
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin: 0 0 14px 0;">${escapeHtml(p)}</p>`)
    .join('')

  const footer = args.footerText
    ? `<p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">${escapeHtml(args.footerText)}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${brand}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 28px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">${brand}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px;">AI-Powered Lead Intelligence</p>
    </div>
    <div style="background: #f9fafb; padding: 28px; border-radius: 0 0 8px 8px;">
      <p style="font-size: 16px; margin: 0 0 18px 0;">Hi ${recipient},</p>
      <div style="background: white; padding: 18px; border-left: 4px solid #06b6d4; margin: 18px 0; border-radius: 6px;">
        ${paragraphs}
      </div>
      <p style="font-size: 14px; color: #6b7280; margin: 18px 0 0 0;">
        Best regards,<br>
        <strong>${sender}</strong><br>
        ${brand} team
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 26px 0;">
      ${footer}
    </div>
  </body>
</html>`
}

export function renderDailyDigestEmailText(args: {
  brandName: string
  dateIso: string
  summary: {
    highPriorityLeadCount: number
    triggerEventCount: number
  }
  leads: Array<{
    companyName: string
    companyDomain: string | null
    score: number
    whyNow: string[]
  }>
}): string {
  const lines: string[] = []
  lines.push(`${args.brandName} Daily Digest (${args.dateIso})`)
  lines.push(`High-priority leads: ${args.summary.highPriorityLeadCount}`)
  lines.push(`Trigger events (7d): ${args.summary.triggerEventCount}`)
  lines.push('')

  for (const lead of args.leads) {
    const domain = lead.companyDomain ? ` (${lead.companyDomain})` : ''
    lines.push(`- ${lead.companyName}${domain} — score ${lead.score}/100`)
    for (const w of lead.whyNow.slice(0, 3)) {
      lines.push(`  • ${w}`)
    }
  }
  lines.push('')
  lines.push('Open LeadIntel to take action.')
  return lines.join('\n')
}

export function renderDailyDigestEmailHtml(args: {
  brandName: string
  dateIso: string
  summary: {
    highPriorityLeadCount: number
    triggerEventCount: number
  }
  leads: Array<{
    companyName: string
    companyDomain: string | null
    score: number
    whyNow: string[]
  }>
  footerText?: string
}): string {
  const brand = escapeHtml(args.brandName)
  const date = escapeHtml(args.dateIso)

  const leadBlocks = args.leads
    .map((l) => {
      const name = escapeHtml(l.companyName)
      const domain = l.companyDomain ? ` <span style="color:#6b7280;">(${escapeHtml(l.companyDomain)})</span>` : ''
      const whyNow = l.whyNow
        .slice(0, 3)
        .map((w) => `<li style="margin: 0 0 6px 0;">${escapeHtml(w)}</li>`)
        .join('')

      return `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 14px 0;">
  <div style="display:flex; justify-content:space-between; gap: 12px; align-items: baseline;">
    <div style="font-size: 15px; font-weight: 700;">${name}${domain}</div>
    <div style="font-size: 12px; color: #111827; background:#f3f4f6; padding: 4px 8px; border-radius: 999px;">Score ${l.score}/100</div>
  </div>
  ${
    whyNow
      ? `<div style="margin-top: 10px;">
        <div style="font-size: 12px; color:#6b7280; font-weight: 600; margin-bottom: 6px;">Why this matters</div>
        <ul style="margin: 0; padding-left: 18px; color:#111827; font-size: 13px;">${whyNow}</ul>
      </div>`
      : ''
  }
</div>`
    })
    .join('')

  const footer = args.footerText
    ? `<p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">${escapeHtml(args.footerText)}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${brand} Daily Digest</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 680px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); padding: 26px; border-radius: 8px 8px 0 0;">
      <div style="color: white; font-size: 18px; font-weight: 800;">${brand} Daily Digest</div>
      <div style="color: rgba(255,255,255,0.9); font-size: 12px; margin-top: 6px;">${date}</div>
    </div>
    <div style="background: #f9fafb; padding: 22px; border-radius: 0 0 8px 8px;">
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px;">
        <div style="font-size: 13px; color:#111827;">
          <strong>${args.summary.highPriorityLeadCount}</strong> new high-priority leads ·
          <strong>${args.summary.triggerEventCount}</strong> trigger events (last 7 days)
        </div>
        <div style="font-size: 12px; color:#6b7280; margin-top: 6px;">
          Log in to review details and take action.
        </div>
      </div>
      ${leadBlocks}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 22px 0;">
      ${footer}
    </div>
  </body>
</html>`
}

