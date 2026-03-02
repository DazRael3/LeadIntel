import { createHash } from 'crypto'

export type DemoTryResult = {
  company: string
  icp: string | null
  digestLines: string[]
  pitchSubject: string
  pitchBody: string
}

function seedFrom(input: string): number {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 8)
  return Number.parseInt(hex, 16) >>> 0
}

function makeRng(seed: number): () => number {
  // LCG (deterministic): good enough for demo content.
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const TRIGGERS = [
  { key: 'funding', label: 'Funding round' },
  { key: 'new_hires', label: 'Hiring spike' },
  { key: 'partnership', label: 'Partnership' },
  { key: 'product_launch', label: 'Product launch' },
  { key: 'expansion', label: 'Expansion signal' },
] as const

function pickN<T>(rng: () => number, items: readonly T[], n: number): T[] {
  const copy = [...items]
  const out: T[] = []
  while (copy.length > 0 && out.length < n) {
    const idx = Math.floor(rng() * copy.length)
    out.push(copy.splice(idx, 1)[0]!)
  }
  return out
}

function normalizeCompany(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, 80)
}

export function generateDemoTryResult(args: { company: string; icp?: string | null }): DemoTryResult {
  const company = normalizeCompany(args.company)
  const icp = (args.icp ?? '').trim().slice(0, 200) || null
  const rng = makeRng(seedFrom(`${company}::${icp ?? ''}`))

  const picks = pickN(rng, TRIGGERS, 3)
  const score = 68 + Math.floor(rng() * 28) // 68–95

  const digestLines = [
    `LeadIntel Daily Digest (Sample)`,
    `Company: ${company}`,
    `Fit score: ${score}/100`,
    ``,
    `Trigger types covered: funding, hiring spikes, partnerships, product launches`,
    ``,
    `Recent signals:`,
    ...picks.map((t, i) => `- ${t.label} detected · priority ${i === 0 ? 'high' : i === 1 ? 'medium' : 'low'}`),
  ]

  const pitchSubject = icp ? `Quick idea for ${company} re: ${icp}` : `Quick idea for ${company}`
  const pitchBody = [
    `Hi — quick note.`,
    ``,
    icp
      ? `We work with ${icp} teams to turn fresh buying signals into timely outbound.`
      : `LeadIntel turns fresh buying signals into timely outbound your reps can use immediately.`,
    ``,
    `Noticed a few recent signals around ${company}. If you're prioritizing pipeline this quarter, it might be worth a quick look.`,
    ``,
    `Open to a 10‑minute chat this week?`,
    ``,
    `— LeadIntel`,
  ].join('\n')

  return { company, icp, digestLines, pitchSubject, pitchBody }
}

