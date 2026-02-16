/**
 * Company key helpers.
 *
 * We store `api.leads.company_domain` as a unique per-user key:
 * - Real domains are stored as-is (normalized to lowercase by DB trigger).
 * - Name-only inputs (no domain) are stored as a deterministic name key `name__<slug>`.
 *
 * This avoids NULL/empty-string collisions under the UNIQUE(user_id, company_domain) constraint,
 * while allowing `/api/pitch/latest` to find name-only history reliably.
 */

export function slugifyCompanyName(input: string): string {
  const raw = input.trim().toLowerCase()
  const slug = raw
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug
}

export function makeNameCompanyKey(input: string): string {
  const slug = slugifyCompanyName(input)
  // Keep within reasonable length for indexing and safety.
  const clipped = (slug || 'unknown').slice(0, 64)
  return `name__${clipped}`
}

export function looksLikeDomain(value: string): boolean {
  const s = value.trim()
  // Very small heuristic: real domains almost always have a dot.
  return s.includes('.')
}

