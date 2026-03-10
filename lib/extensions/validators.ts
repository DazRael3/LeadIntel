const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

export type ValidationResult = { ok: true } | { ok: false; reason: string }

const ALLOWED_VARS = new Set<string>([
  'account.id',
  'account.name',
  'account.domain',
  'account.program_state',
  'account.lead_id',
  'workspace.id',
  'computedAt',
])

function validateStringTemplate(s: string): ValidationResult {
  let match: RegExpExecArray | null = null
  while ((match = TEMPLATE_VAR_RE.exec(s)) !== null) {
    const key = (match[1] ?? '').trim()
    if (!key || !ALLOWED_VARS.has(key)) return { ok: false, reason: `Disallowed template var: ${key || '(empty)'}` }
  }
  return { ok: true }
}

function validateValue(v: unknown, depth: number): ValidationResult {
  if (depth > 6) return { ok: false, reason: 'Template too deep' }
  if (v === null) return { ok: true }
  if (typeof v === 'string') return validateStringTemplate(v)
  if (typeof v === 'number' || typeof v === 'boolean') return { ok: true }
  if (Array.isArray(v)) {
    if (v.length > 50) return { ok: false, reason: 'Array too large' }
    for (const item of v) {
      const r = validateValue(item, depth + 1)
      if (!r.ok) return r
    }
    return { ok: true }
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length > 80) return { ok: false, reason: 'Object too large' }
    for (const k of keys) {
      if (k.length > 80) return { ok: false, reason: 'Key too long' }
      const r = validateValue(obj[k], depth + 1)
      if (!r.ok) return r
    }
    return { ok: true }
  }
  return { ok: false, reason: 'Unsupported value type' }
}

export function validatePayloadTemplate(template: unknown): ValidationResult {
  if (!template || typeof template !== 'object' || Array.isArray(template)) return { ok: false, reason: 'Template must be an object' }
  return validateValue(template, 0)
}

