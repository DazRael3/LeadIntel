import type { FirstPartyIntent, SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'

export type OutreachVariantChannel = 'email' | 'linkedin_dm' | 'call_opener'

export type OutreachVariant = {
  id: string
  persona: string
  channel: OutreachVariantChannel
  angle: string
  opener: string
  whyNowBullets: string[]
  limitations: string[]
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function uniq<T>(items: T[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const x of items) {
    const k = JSON.stringify(x)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function safeTitle(s: SignalEvent): string | null {
  const t = (s.title ?? '').trim()
  if (!t) return null
  // Keep it short enough for an opener without truncation artifacts.
  return t.length > 140 ? t.slice(0, 137) + '...' : t
}

function buildWhyNowBullets(args: { momentum: SignalMomentum | null; signals: SignalEvent[]; max: number }): string[] {
  const bullets: string[] = []
  if (args.momentum) {
    const m = args.momentum
    bullets.push(`Momentum is ${m.label}${typeof m.delta === 'number' ? ` (${m.delta >= 0 ? '+' : ''}${m.delta})` : ''}.`)
  }
  for (const s of args.signals) {
    const t = safeTitle(s)
    if (!t) continue
    bullets.push(t)
    if (bullets.length >= args.max) break
  }
  return bullets
}

function channelLabelToChannel(label: string): OutreachVariantChannel {
  const v = label.trim().toLowerCase()
  if (v === 'email') return 'email'
  if (v === 'linkedin_dm' || v === 'linkedin') return 'linkedin_dm'
  if (v === 'call_opener' || v === 'call') return 'call_opener'
  return 'email'
}

function buildGenericOpener(args: {
  companyName: string
  persona: string
  signalTitle: string | null
  momentum: SignalMomentum | null
}): string {
  const company = args.companyName.trim() || 'your team'
  const who = args.persona.trim() || 'your team'
  const cue = args.signalTitle ? `Noticed: ${args.signalTitle}.` : args.momentum ? `Noticed ${args.momentum.label} momentum on your watchlist.` : 'Noticed activity on your watchlist.'
  return `${cue}\n\nQuick question for the ${who} side at ${company}: what’s the current priority—pipeline creation, conversion, or standardizing outbound?\n\nWorth 10 minutes this week?`
}

function buildFirstPartyOpener(args: {
  companyName: string
  persona: string
  firstPartyIntent: FirstPartyIntent
  momentum: SignalMomentum | null
}): string | null {
  const count = args.firstPartyIntent.visitorMatches.count
  const last = args.firstPartyIntent.visitorMatches.lastVisitedAt
  if (!(count > 0) || !last) return null
  const company = args.companyName.trim() || 'your team'
  const who = args.persona.trim() || 'your team'
  const momentumLine = args.momentum ? `Momentum: ${args.momentum.label} (${args.momentum.delta >= 0 ? '+' : ''}${args.momentum.delta}).` : null
  const cue = `We’ve seen repeat visits from your company domain recently (last: ${new Date(last).toISOString().slice(0, 10)}).`
  return `${cue}${momentumLine ? ` ${momentumLine}` : ''}\n\nFor the ${who} side at ${company}: are you actively evaluating changes to your outbound workflow, or just gathering context?\n\nIf helpful, I can share a short, signal-backed summary of what we’re seeing.`
}

export function buildOutreachVariants(args: {
  companyName: string
  personas: PersonaRecommendationSummary | null
  momentum: SignalMomentum | null
  firstPartyIntent: FirstPartyIntent | null
  signals: SignalEvent[]
  maxVariants?: number
}): OutreachVariant[] {
  const maxVariants = clamp(Math.floor(args.maxVariants ?? 6), 1, 10)

  const topSignals = args.signals.slice(0, 5)
  const topSignalTitle = topSignals.map((s) => safeTitle(s)).find((x): x is string => typeof x === 'string' && x.length > 0) ?? null

  const baseBullets = buildWhyNowBullets({ momentum: args.momentum, signals: topSignals, max: 4 })
  const limitations: string[] = []
  if (topSignals.length === 0) limitations.push('Limited signal coverage for this account.')
  if (!args.firstPartyIntent || args.firstPartyIntent.visitorMatches.count === 0) limitations.push('No recent first-party visitor matches detected.')

  const variants: OutreachVariant[] = []

  const personaItems = (args.personas?.items ?? []).slice(0, 4)
  for (const p of personaItems) {
    const channel = channelLabelToChannel(p.suggestedFirstTouch.channel)
    const opener = (p.suggestedFirstTouch.text ?? '').trim()
    if (!opener) continue
    const combinedLimitations = uniq([...(limitations ?? []), ...(p.limitations ?? [])])
    variants.push({
      id: `persona:${p.persona}:${p.priority}`,
      persona: p.persona,
      channel,
      angle: p.whyNowAngle,
      opener,
      whyNowBullets: baseBullets,
      limitations: combinedLimitations,
    })
    if (variants.length >= maxVariants) break
  }

  if (variants.length < maxVariants) {
    variants.push({
      id: `generic:operator`,
      persona: 'Operator / RevOps',
      channel: 'email',
      angle: args.momentum ? `Timing looks ${args.momentum.label} — tighten execution while recency is fresh.` : 'Timing-first outreach with clear next step.',
      opener: buildGenericOpener({
        companyName: args.companyName,
        persona: 'RevOps',
        signalTitle: topSignalTitle,
        momentum: args.momentum,
      }),
      whyNowBullets: baseBullets,
      limitations,
    })
  }

  if (variants.length < maxVariants && args.firstPartyIntent) {
    const fp = buildFirstPartyOpener({
      companyName: args.companyName,
      persona: 'RevOps',
      firstPartyIntent: args.firstPartyIntent,
      momentum: args.momentum,
    })
    if (fp) {
      variants.push({
        id: `first_party:intent`,
        persona: 'RevOps',
        channel: 'email',
        angle: 'First-party intent suggests active research — lead with timing and a small next step.',
        opener: fp,
        whyNowBullets: baseBullets,
        limitations: limitations.filter((x) => x !== 'No recent first-party visitor matches detected.'),
      })
    }
  }

  return uniq(variants).slice(0, maxVariants)
}

