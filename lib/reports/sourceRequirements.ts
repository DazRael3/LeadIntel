import type { NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations } from '@/lib/sources/normalize'
import { MIN_CITATIONS } from '@/lib/reports/reportInput'

export { MIN_CITATIONS }

export function flattenCitations(args: {
  external: NormalizedCitation[]
  internalSignalUrls: string[]
}): NormalizedCitation[] {
  const internal = args.internalSignalUrls
    .filter((u) => typeof u === 'string' && u.trim().startsWith('http'))
    .map((u) => ({ url: u.trim(), source: 'LeadIntel', type: 'internal_signal' as const }))

  return normalizeCitations([...(args.external ?? []), ...internal]).slice(0, 100)
}

export function countUniqueCitations(citations: NormalizedCitation[]): number {
  const set = new Set<string>()
  for (const c of citations) {
    const url = (c.url ?? '').trim()
    if (!url) continue
    set.add(url.toLowerCase())
  }
  return set.size
}

export function assertMinCitationsOrThrow(citations: NormalizedCitation[]): void {
  const n = countUniqueCitations(citations)
  if (n < MIN_CITATIONS) {
    throw new Error('NO_SOURCES_FOUND')
  }
}

