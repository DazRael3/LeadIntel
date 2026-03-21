export type ProspectSignalType =
  | 'hiring'
  | 'funding'
  | 'product_launch'
  | 'partnership'
  | 'expansion'
  | 'leadership_hire'
  | 'stack_change'
  | 'other'

export type ClassifiedSignal = {
  signalType: ProspectSignalType
  confidence: number // 0-100
  summary: string
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function norm(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

export function classifySignal(args: {
  title: string
  snippet: string | null
  url: string
}): ClassifiedSignal {
  const title = norm(args.title)
  const snippet = norm(args.snippet ?? '')
  const blob = `${title}\n${snippet}\n${args.url}`.toLowerCase()

  const rules: Array<{ type: ProspectSignalType; weight: number; match: RegExp; summary: string }> = [
    { type: 'funding', weight: 0.95, match: /\b(raises|raised|funding|series [a-f]|seed round|venture|valuation|capital raise)\b/i, summary: 'Funding / capital activity' },
    { type: 'hiring', weight: 0.8, match: /\b(hiring|we are hiring|careers|job openings|sales (development|dev) rep|account executive|head of sales|vp sales)\b/i, summary: 'Hiring / team growth' },
    { type: 'product_launch', weight: 0.78, match: /\b(launch|released|release notes|announc(?:e|ement)|ga\b|generally available|new feature)\b/i, summary: 'Product launch / release' },
    { type: 'partnership', weight: 0.75, match: /\b(partner(?:ship)?|joins forces|integration with|strategic alliance)\b/i, summary: 'Partnership / integration announcement' },
    { type: 'expansion', weight: 0.72, match: /\b(expands|expansion|new market|opens (a|an) (office|region)|international)\b/i, summary: 'Expansion / new market motion' },
    { type: 'leadership_hire', weight: 0.7, match: /\b(appoints|named|joins as|chief revenue officer|cro\b|vp (sales|marketing)|head of (sales|growth|revenue))\b/i, summary: 'Leadership / GTM hire' },
    { type: 'stack_change', weight: 0.62, match: /\b(migrat(?:e|ion)|switched to|stack|replaced|deprecates|sunset)\b/i, summary: 'Stack change / displacement hint' },
  ]

  for (const r of rules) {
    if (r.match.test(blob)) {
      return {
        signalType: r.type,
        confidence: clampInt(r.weight * 100, 30, 98),
        summary: r.summary,
      }
    }
  }

  return { signalType: 'other', confidence: 45, summary: 'Public update' }
}

