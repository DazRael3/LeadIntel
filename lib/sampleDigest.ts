export type SampleDigestOutreachChannel = 'email' | 'linkedin'

export type SampleDigestResult = {
  company: string
  score: number
  triggers: string[]
  whyNow: string
  outreach: {
    channel: SampleDigestOutreachChannel
    subject?: string
    body: string
  }
  disclaimer: string
}

function normalizeCompanyInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 200)
}

// FNV-1a 32-bit hash for stable deterministic output.
function hash32(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    // hash *= 16777619 (with 32-bit overflow)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return hash >>> 0
}

function pickTriggers(seed: number, count: number): string[] {
  const all = [
    'Funding activity',
    'Hiring spike (role-specific)',
    'Product launch / roadmap signal',
    'New partnership / integration',
    'Press mention / award',
    'Stack change (tools/vendor swap)',
    'Expansion signal (new geo/segment)',
    'Security/compliance initiative',
  ] as const

  const out: string[] = []
  let s = seed
  while (out.length < count) {
    s = (s * 1664525 + 1013904223) >>> 0
    const idx = s % all.length
    const next = all[idx]
    if (!out.includes(next)) out.push(next)
  }
  return out
}

function scoreFromSeed(seed: number): number {
  // 0–100 inclusive, slightly biased toward mid/high for demo appeal.
  const base = seed % 101
  const bump = (seed >>> 8) % 18
  return Math.min(100, Math.floor((base * 0.7 + bump * 1.2) % 101))
}

function buildWhyNow(company: string, triggers: string[], score: number): string {
  const t1 = triggers[0] ?? 'recent activity'
  const t2 = triggers[1] ?? 'hiring signals'
  const urgency =
    score >= 80 ? 'high intent' : score >= 55 ? 'active evaluation' : 'early research'
  return `${company} is showing ${urgency} signals: ${t1.toLowerCase()} plus ${t2.toLowerCase()}. This is a good “why now” moment to reach out with a specific point of view and a short next step.`
}

function buildOutreach(company: string, triggers: string[], channel: SampleDigestOutreachChannel): SampleDigestResult['outreach'] {
  const bulletA = triggers[0] ?? 'recent activity'
  const bulletB = triggers[1] ?? 'hiring signals'
  const bulletC = triggers[2] ?? 'product momentum'

  if (channel === 'linkedin') {
    return {
      channel,
      body: `Hey — saw ${company} around ${bulletA.toLowerCase()} and ${bulletB.toLowerCase()}.\n\nQuick question: are you prioritizing ${bulletC.toLowerCase()} this quarter? If so, happy to share a 2‑minute idea we’re using to help similar teams move faster.`,
    }
  }

  return {
    channel,
    subject: `Quick idea for ${company}`,
    body: `Hi there —\n\nNoticed a few signals from ${company}:\n- ${bulletA}\n- ${bulletB}\n- ${bulletC}\n\nIf you’re working on this right now, I can send a short, tailored walkthrough of how teams like yours use daily “why now” signals to prioritize accounts and book meetings.\n\nWorth a quick 10 minutes this week?`,
  }
}

export function generateSampleDigest(companyOrUrl: string): SampleDigestResult {
  const company = normalizeCompanyInput(companyOrUrl)
  const seed = hash32(company.toLowerCase())
  const score = scoreFromSeed(seed)
  const triggerCount = 3 + (seed % 3) // 3–5
  const triggers = pickTriggers(seed, triggerCount)
  const whyNow = buildWhyNow(company, triggers, score)
  const outreach = buildOutreach(company, triggers, (seed % 2 === 0 ? 'email' : 'linkedin'))

  return {
    company,
    score,
    triggers,
    whyNow,
    outreach,
    disclaimer: 'Sample output — generated from deterministic demo data (not live signals).',
  }
}

