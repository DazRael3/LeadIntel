export type SampleDigestOutreachChannel = 'email' | 'linkedin'

export type SampleDigestResult = {
  company: string
  score: number
  triggers: string[]
  scoreFactors: string[]
  updatedAt: string
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

type TriggerSignal = {
  key: 'hiring_spike' | 'funding' | 'expansion' | 'new_roles'
  label: string
  scoreFactor: string
  outreachAngle: string
}

const TRIGGER_SIGNALS: readonly TriggerSignal[] = [
  {
    key: 'hiring_spike',
    label: 'Hiring spike in go-to-market roles',
    scoreFactor: 'Hiring momentum suggests active pipeline goals',
    outreachAngle: 'new hiring velocity usually means immediate demand creation pressure',
  },
  {
    key: 'funding',
    label: 'Recent funding momentum',
    scoreFactor: 'Fresh capital often accelerates outbound investment',
    outreachAngle: 'post-funding teams typically move fast on repeatable outbound execution',
  },
  {
    key: 'expansion',
    label: 'Expansion into a new segment or region',
    scoreFactor: 'Expansion signals near-term market-entry outreach needs',
    outreachAngle: 'expansion initiatives need rapid account prioritization and messaging',
  },
  {
    key: 'new_roles',
    label: 'New strategic roles opened',
    scoreFactor: 'New leadership roles indicate upcoming execution changes',
    outreachAngle: 'new role ownership often triggers immediate process and tooling adjustments',
  },
] as const

function pickSignals(seed: number, count: number): TriggerSignal[] {
  const out: TriggerSignal[] = []

  let s = seed
  while (out.length < count) {
    s = (s * 1664525 + 1013904223) >>> 0
    const idx = s % TRIGGER_SIGNALS.length
    const next = TRIGGER_SIGNALS[idx]
    if (!out.find((signal) => signal.key === next.key)) out.push(next)
  }
  return out
}

function scoreFromSeed(seed: number): number {
  // 0–100 inclusive, biased toward realistic high-intent demo scores.
  const base = 58 + (seed % 31) // 58-88
  const bump = (seed >>> 8) % 12 // 0-11
  return Math.min(99, base + bump)
}

function buildWhyNow(company: string, signals: TriggerSignal[]): string {
  const primary = signals[0] ?? TRIGGER_SIGNALS[0]
  const secondary = signals[1] ?? TRIGGER_SIGNALS[1]
  return `${company} is showing ${primary.label.toLowerCase()} and ${secondary.label.toLowerCase()}. Reach out now while these active triggers are fresh.`
}

function buildScoreFactors(signals: TriggerSignal[]): string[] {
  return signals.slice(0, 3).map((signal) => signal.scoreFactor)
}

function buildOutreach(company: string, signals: TriggerSignal[], channel: SampleDigestOutreachChannel): SampleDigestResult['outreach'] {
  const primary = signals[0] ?? TRIGGER_SIGNALS[0]
  const secondary = signals[1] ?? TRIGGER_SIGNALS[1]

  if (channel === 'linkedin') {
    return {
      channel,
      body: `Saw ${company}'s ${primary.label.toLowerCase()}. We help teams turn signals like ${secondary.label.toLowerCase()} into send-ready outbound in minutes. Open to a quick walkthrough this week?`,
    }
  }

  return {
    channel,
    subject: `${company}: signal-driven outbound idea`,
    body: `Noticed ${company}'s ${primary.label.toLowerCase()}. ${primary.outreachAngle.charAt(0).toUpperCase()}${primary.outreachAngle.slice(1)}, and we help teams act on it with ready-to-send outreach. Worth a quick 10-minute walkthrough this week?`,
  }
}

export function generateSampleDigest(companyOrUrl: string): SampleDigestResult {
  const company = normalizeCompanyInput(companyOrUrl)
  const seed = hash32(company.toLowerCase())
  const score = scoreFromSeed(seed)
  const signalCount = 3
  const signals = pickSignals(seed, signalCount)
  const triggers = signals.map((signal) => signal.label)
  const scoreFactors = buildScoreFactors(signals)
  const whyNow = buildWhyNow(company, signals)
  const outreach = buildOutreach(company, signals, seed % 2 === 0 ? 'email' : 'linkedin')

  return {
    company,
    score,
    triggers,
    scoreFactors,
    updatedAt: new Date().toISOString(),
    whyNow,
    outreach,
    disclaimer: 'Sample output — generated from deterministic demo data (not live signals).',
  }
}

