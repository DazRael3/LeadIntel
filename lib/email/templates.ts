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
        ${brand} Autonomous Revenue Agent
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 26px 0;">
      ${footer}
    </div>
  </body>
</html>`
}

