import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import { safeExternalLink } from '@/lib/domain/explainability'
import { derivePersonaRecommendations } from '@/lib/services/persona-recommendations'

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

  const persona = derivePersonaRecommendations({
    companyName: company,
    signals: input.signals,
    momentum: input.momentum,
    firstPartyVisitorCount14d: input.firstPartyIntent.visitorMatchesCount,
    userContext: input.userContext,
  })
  const top = persona.items[0] ?? null

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
${persona.topPersonas.length > 0 ? persona.topPersonas.map((p) => `- ${p}`).join('\n') : '- Persona targets not available yet.'}

## Recommended outreach angle
${top?.whyNowAngle ?? 'Use a short why-now opener tied to the highest-signal event and ask a single, concrete question.'}

## Recommended first touch (${top?.suggestedFirstTouch.channel ?? 'email'})
${(top?.suggestedFirstTouch.text ?? '').replaceAll('{{company}}', company).trim() || `Quick question for ${company}: what’s driving priority right now—pipeline creation, conversion, or standardizing outbound?\n\nWorth 10 minutes this week?`}

## Objections to expect
- We’re already using a tool for that.
- Not a priority right now.
- Send info.
- Not my area.

## Next best action
${top ? 'Use the recommended first touch for the top persona and ask one concrete routing/prioritization question.' : 'Generate an outreach draft and send a first-touch to a relevant persona.'}

## Sources & freshness
${sourcesFreshness}

${sourcesSection}
`
}

