import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import { safeExternalLink } from '@/lib/domain/explainability'

export type AccountBriefInput = {
  account: {
    id: string
    companyName: string
    companyDomain: string | null
    inputUrl: string | null
  }
  window: '7d' | '30d' | '90d' | 'all'
  momentum: SignalMomentum | null
  signals: SignalEvent[]
  firstPartyIntent: {
    visitorMatchesCount: number
    lastVisitedAt: string | null
  }
  firstPartySources: {
    fetchedAt: string | null
    citations: Array<{ url: string; title?: string | null }>
  }
  userContext: {
    whatYouSell: string | null
    idealCustomer: string | null
  }
}

type PersonaRecommendation = {
  personas: string[]
  angle: string
  firstTouch: { channel: 'email' | 'linkedin_dm' | 'call'; text: string }
  objections: string[]
  nextBestAction: string
}

function uniqStrings(items: string[], limit: number): string[] {
  const out: string[] = []
  for (const x of items) {
    const v = x.trim()
    if (!v) continue
    if (!out.includes(v)) out.push(v)
    if (out.length >= limit) break
  }
  return out
}

function normalizeSignalKey(type: string): string {
  return type.trim().toLowerCase()
}

function recommendFromSignals(args: {
  signalTypes: string[]
  visitorMatchesCount: number
  hasFirstPartySources: boolean
  whatYouSell: string | null
  idealCustomer: string | null
}): PersonaRecommendation {
  const types = args.signalTypes.map(normalizeSignalKey)
  const personas: string[] = []
  const objections: string[] = []

  const addPersona = (p: string) => personas.push(p)
  const addObj = (o: string) => objections.push(o)

  let angle = 'Use a short why-now opener tied to the highest-signal event and ask a single, concrete question.'
  let channel: PersonaRecommendation['firstTouch']['channel'] = 'email'

  if (types.some((t) => t.includes('new_hires') || t.includes('hiring'))) {
    addPersona('RevOps / Sales Ops')
    addPersona('Sales Enablement')
    addPersona('VP Sales')
    angle = 'Anchor on the hiring/enablement push: teams often standardize process and tooling while ramping.'
    addObj('We’re already using a tool for that.')
    addObj('Not a priority right now.')
  }
  if (types.some((t) => t.includes('funding'))) {
    addPersona('VP Sales')
    addPersona('Head of Growth')
    addPersona('CRO')
    angle = 'Anchor on execution speed: after funding, teams push pipeline, process, and repeatable outbound.'
    addObj('We’re scaling, but timing isn’t right.')
  }
  if (types.some((t) => t.includes('product_launch'))) {
    addPersona('Product Marketing')
    addPersona('Demand Gen')
    addPersona('Sales Enablement')
    angle = 'Anchor on packaging/messaging: launches often change who should be targeted and what the opener should say.'
    addObj('Send info.')
  }
  if (types.some((t) => t.includes('partnership'))) {
    addPersona('Partnerships')
    addPersona('Revenue Operations')
    angle = 'Anchor on GTM coordination: partnerships create new segments and routing questions.'
    addObj('Not my area.')
  }
  if (types.some((t) => t.includes('expansion') || t.includes('market_expansion'))) {
    addPersona('Sales Leadership')
    addPersona('RevOps / Sales Ops')
    angle = 'Anchor on expansion execution: new markets usually mean new playbooks, targeting, and operational changes.'
  }

  if (args.visitorMatchesCount > 0) {
    addPersona('RevOps / Sales Ops')
    angle = 'Use the first-party intent: they’re showing up. Keep it short and ask a routing question.'
    channel = 'linkedin_dm'
  }

  if (args.hasFirstPartySources) {
    addObj('What’s the evidence this matters now?')
  }

  const whatYouSell = (args.whatYouSell ?? '').trim()
  const idealCustomer = (args.idealCustomer ?? '').trim()
  const valueLine =
    whatYouSell && idealCustomer
      ? `We help ${idealCustomer} with ${whatYouSell}.`
      : whatYouSell
        ? `We help teams with ${whatYouSell}.`
        : 'We help outbound teams turn timing signals into a daily shortlist and send-ready outreach.'

  const firstTouchText =
    channel === 'email'
      ? `Quick question for {{company}}: what’s driving priority right now—pipeline creation, conversion, or standardizing your outbound motion?\n\n${valueLine}\n\nIf it’s helpful, I can share a short checklist for turning why-now signals into a daily shortlist and first touches reps can send.\n\nWorth 10 minutes this week?`
      : channel === 'linkedin_dm'
        ? `Saw recent momentum around {{company}} — quick question: is the focus pipeline creation, conversion, or standardizing outbound right now?\n\n${valueLine}\n\nIf helpful, I can share a short why-now workflow (daily shortlist + send-ready first touches).`
        : `Hi {{name}} — quick question: how are you deciding which accounts deserve outreach *this week* at {{company}}?\n\n${valueLine}\n\nIf helpful, I can share a short workflow for turning why-now signals into a daily shortlist and send-ready first touches.`

  const nextBestAction =
    args.visitorMatchesCount > 0
      ? 'Send a short first-touch (DM or email) referencing timing and ask a routing question.'
      : 'Generate an outreach draft and send a first-touch to the highest-momentum persona.'

  return {
    personas: uniqStrings(personas, 5),
    angle,
    firstTouch: { channel, text: firstTouchText },
    objections: uniqStrings(objections, 6),
    nextBestAction,
  }
}

function formatSourcesSection(args: { signals: SignalEvent[]; firstPartyCitations: Array<{ url: string; title?: string | null }> }): string {
  const links: Array<{ label: string; url: string }> = []

  for (const s of args.signals) {
    const url = safeExternalLink(s.sourceUrl)
    if (!url) continue
    const label = s.title.trim().slice(0, 140) || 'Signal source'
    links.push({ label, url })
    if (links.length >= 6) break
  }

  for (const c of args.firstPartyCitations) {
    if (links.length >= 10) break
    const url = safeExternalLink(c.url)
    if (!url) continue
    const label = (c.title ?? '').trim().slice(0, 140) || 'First-party source'
    links.push({ label, url })
  }

  if (links.length === 0) return '## Sources\n\nNo source links were available for this brief.\n'

  return `## Sources\n\n${links.map((l) => `- [${l.label}](${l.url})`).join('\n')}\n`
}

export function buildAccountBriefMarkdown(input: AccountBriefInput): string {
  const company = input.account.companyName
  const domainLine = input.account.companyDomain ? ` (${input.account.companyDomain})` : ''
  const w = input.window

  const signalTypes = input.signals.map((s) => s.type)
  const rec = recommendFromSignals({
    signalTypes,
    visitorMatchesCount: input.firstPartyIntent.visitorMatchesCount,
    hasFirstPartySources: input.firstPartySources.citations.length > 0,
    whatYouSell: input.userContext.whatYouSell,
    idealCustomer: input.userContext.idealCustomer,
  })

  const momentum = input.momentum
  const whyNow =
    momentum
      ? `Momentum is **${momentum.label}** (\(${momentum.delta >= 0 ? '+' : ''}${momentum.delta}\) vs prior window). High-signal events: **${momentum.highSignalEvents}**.`
      : 'Momentum is not available for this account yet.'

  const topSignals = input.signals.slice(0, 6)
  const topSignalsLines =
    topSignals.length > 0
      ? topSignals.map((s) => {
          const when = s.occurredAt ?? s.detectedAt
          const src = safeExternalLink(s.sourceUrl)
          const suffix = src ? ` ([source](${src}))` : ''
          return `- **${s.title}** — ${when}${suffix}`
        })
      : ['- No active signals in this window.']

  const icpRecap =
    (input.userContext.idealCustomer ?? '').trim().length > 0 || (input.userContext.whatYouSell ?? '').trim().length > 0
      ? `- Ideal customer: ${input.userContext.idealCustomer ?? '—'}\n- What you sell: ${input.userContext.whatYouSell ?? '—'}`
      : '- ICP is not configured yet. Configure ICP to tighten scoring and outreach.'

  const firstPartyRecap =
    input.firstPartyIntent.visitorMatchesCount > 0
      ? `- Website visitors matched (14d): **${input.firstPartyIntent.visitorMatchesCount}**\n- Most recent visit: ${input.firstPartyIntent.lastVisitedAt ?? '—'}`
      : '- No recent website visitor matches for this domain.'

  const sourcesFreshness =
    input.firstPartySources.fetchedAt
      ? `First-party sources last fetched: ${input.firstPartySources.fetchedAt}`
      : 'First-party sources have not been fetched yet for this account.'

  const sourcesSection = formatSourcesSection({ signals: input.signals, firstPartyCitations: input.firstPartySources.citations })

  return `# Account brief: ${company}${domainLine}

## Why now (window: ${w})
${whyNow}

## Top active signals
${topSignalsLines.join('\n')}

## ICP fit recap
${icpRecap}

## First-party intent recap
${firstPartyRecap}

## Recommended persona targets
${rec.personas.length > 0 ? rec.personas.map((p) => `- ${p}`).join('\n') : '- Persona targets not available yet.'}

## Recommended outreach angle
${rec.angle}

## Recommended first touch (${rec.firstTouch.channel})
${rec.firstTouch.text.replaceAll('{{company}}', company)}

## Objections to expect
${rec.objections.length > 0 ? rec.objections.map((o) => `- ${o}`).join('\n') : '- No common objections available yet.'}

## Next best action
${rec.nextBestAction}

## Sources & freshness
${sourcesFreshness}

${sourcesSection}
`
}

