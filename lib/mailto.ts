export function buildMailto(email: string, subject: string, body?: string): string {
  const to = (email ?? '').trim()
  const params = new URLSearchParams()
  params.set('subject', subject)
  if (typeof body === 'string' && body.trim().length > 0) params.set('body', body)
  const qs = params.toString()
  return `mailto:${encodeURIComponent(to)}?${qs}`
}

