import type { AiGenerateInput } from '@/lib/ai/providers/types'

const REDACTION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses.
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
  // Phone numbers.
  { pattern: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?){2}\d{4}\b/g, replacement: '[REDACTED_PHONE]' },
  // Bearer tokens.
  { pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/g, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Stripe and common prefixed keys.
  { pattern: /\b(?:sk|pk|rk|re)_(?:live|test)?[_A-Za-z0-9-]{8,}\b/gi, replacement: '[REDACTED_API_KEY]' },
  // Supabase service-role style secrets.
  { pattern: /\bsb_secret_[A-Za-z0-9_-]{8,}\b/g, replacement: '[REDACTED_SUPABASE_SECRET]' },
  { pattern: /\bservice_role\b/gi, replacement: '[REDACTED_SERVICE_ROLE]' },
  // JWT-like tokens.
  { pattern: /\beyJ[A-Za-z0-9_-]{3,}\.[A-Za-z0-9._-]{3,}\.[A-Za-z0-9._-]{3,}\b/g, replacement: '[REDACTED_JWT]' },
  // Cookie-like assignments.
  { pattern: /\b(?:cookie|set-cookie)\s*:\s*[^;\n]+/gi, replacement: 'cookie: [REDACTED_COOKIE]' },
  // Generic assignment patterns for token/password/secret/key fields.
  {
    pattern: /\b(?:api[_-]?key|token|password|secret|session|auth)\s*[:=]\s*["']?[^"'\s,;]{6,}["']?/gi,
    replacement: '[REDACTED_CREDENTIAL]',
  },
  // Obvious street address patterns.
  {
    pattern: /\b\d{1,6}\s+[A-Za-z0-9.\-'\s]{2,40}\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)\b\.?/gi,
    replacement: '[REDACTED_ADDRESS]',
  },
]

const SECRET_DETECT_PATTERNS: RegExp[] = [
  /\bsk_(?:live|test)?[_A-Za-z0-9-]{8,}\b/i,
  /\bpk_(?:live|test)?[_A-Za-z0-9-]{8,}\b/i,
  /\bre_[A-Za-z0-9_-]{8,}\b/i,
  /\bsb_secret_[A-Za-z0-9_-]{8,}\b/i,
  /\bservice_role\b/i,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/i,
  /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/,
]

export function containsPotentialSecret(value: string): boolean {
  return SECRET_DETECT_PATTERNS.some((pattern) => pattern.test(value))
}

export function redactPrompt(value: string): string {
  let output = value
  for (const rule of REDACTION_RULES) {
    output = output.replace(rule.pattern, rule.replacement)
  }
  return output
}

export function redactAiGenerateInput(
  input: AiGenerateInput
): { input: AiGenerateInput; wasRedacted: boolean } {
  const redactedSystem = typeof input.system === 'string' ? redactPrompt(input.system) : undefined
  const redactedPrompt = redactPrompt(input.prompt)
  const wasRedacted =
    redactedPrompt !== input.prompt ||
    (typeof input.system === 'string' && redactedSystem !== input.system)

  return {
    input: {
      ...input,
      system: redactedSystem,
      prompt: redactedPrompt,
    },
    wasRedacted,
  }
}
