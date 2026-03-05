const TOKEN_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g

export function extractCurlyTokens(input: string): string[] {
  const tokens = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(input)) !== null) {
    const t = (m[1] ?? '').trim()
    if (t) tokens.add(t)
  }
  return Array.from(tokens).sort()
}

export function validateCurlyTokensOnly(input: string): { ok: true } | { ok: false; message: string } {
  // Remove valid tokens, then ensure no stray braces remain.
  const stripped = input.replace(TOKEN_RE, '')
  if (stripped.includes('{') || stripped.includes('}')) {
    return { ok: false, message: 'Curly tokens only. Use {{token}} format.' }
  }
  return { ok: true }
}

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

