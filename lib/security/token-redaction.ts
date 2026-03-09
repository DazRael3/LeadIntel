const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // Common API keys / secrets
  { re: /\bsk_[A-Za-z0-9_]{8,}\b/g, replacement: 'sk_[REDACTED]' },
  { re: /\bwhsec_[A-Za-z0-9_]{8,}\b/g, replacement: 'whsec_[REDACTED]' },
  { re: /\bre_[A-Za-z0-9_]{8,}\b/g, replacement: 're_[REDACTED]' },
  { re: /\bsb_secret_[A-Za-z0-9_]{8,}\b/g, replacement: 'sb_secret_[REDACTED]' },
  { re: /\bsb_publishable_[A-Za-z0-9_]{8,}\b/g, replacement: 'sb_publishable_[REDACTED]' },
  // Bearer tokens
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g, replacement: 'Bearer [REDACTED]' },
  // JWT-like strings (very rough): three dot-separated base64url-ish segments
  { re: /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: '[REDACTED_JWT]' },
]

export function redactPotentialSecrets(input: string): string {
  let out = input
  for (const p of PATTERNS) out = out.replace(p.re, p.replacement)
  return out
}

