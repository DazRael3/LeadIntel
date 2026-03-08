import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import { formatSignalType } from '@/lib/domain/explainability'
import type {
  PersonaAngle,
  PersonaCategory,
  PersonaFirstTouchChannel,
  PersonaRecommendationSummary,
  PersonaRole,
} from '@/lib/domain/people'

function uniq<T>(items: T[]): T[] {
  const out: T[] = []
  for (const x of items) if (!out.includes(x)) out.push(x)
  return out
}

function normalizeType(type: string): string {
  return type.trim().toLowerCase()
}

function confidenceFromEvidence(args: { signalCount: number; distinctSignalTypes: number; firstPartyVisitorCount14d: number }): PersonaRecommendationSummary['confidence'] {
  if (args.signalCount >= 6 || args.firstPartyVisitorCount14d >= 4) return 'strong'
  if (args.signalCount >= 2 || args.firstPartyVisitorCount14d >= 1) return 'usable'
  return 'limited'
}

function buildFirstTouch(args: {
  channel: PersonaFirstTouchChannel
  companyName: string
  persona: PersonaRole
  whyNowCue: string
  valueLine: string
}): string {
  const cue = args.whyNowCue.trim()
  const base = args.valueLine.trim()
  if (args.channel === 'linkedin_dm') {
    return `${cue} — quick question for ${args.persona}: what’s driving priority at ${args.companyName} right now (pipeline creation vs process standardization)?\n\n${base}\n\nIf helpful, I can share a short why-now workflow (daily shortlist + send-ready first touches).`
  }
  if (args.channel === 'call') {
    return `Hi — calling about ${args.companyName}. ${cue}\n\nQuick question for ${args.persona}: how are you deciding which accounts deserve outreach this week?\n\n${base}`
  }
  return `${cue}\n\nQuick question for ${args.persona}: what’s driving priority at ${args.companyName} right now—pipeline creation, conversion, or standardizing outbound?\n\n${base}\n\nWorth 10 minutes this week?`
}

export function derivePersonaRecommendations(args: {
  companyName: string
  signals: SignalEvent[]
  momentum: SignalMomentum | null
  firstPartyVisitorCount14d: number
  userContext: { whatYouSell: string | null; idealCustomer: string | null }
}): PersonaRecommendationSummary {
  const companyName = args.companyName.trim() || 'this account'
  const signalTypes = args.signals.map((s) => normalizeType(s.type))
  const distinctTypes = new Set(signalTypes.filter(Boolean))

  const valueLine = (() => {
    const whatYouSell = (args.userContext.whatYouSell ?? '').trim()
    const idealCustomer = (args.userContext.idealCustomer ?? '').trim()
    if (whatYouSell && idealCustomer) return `We help ${idealCustomer} with ${whatYouSell}.`
    if (whatYouSell) return `We help teams with ${whatYouSell}.`
    return 'We help outbound teams turn timing signals into a daily shortlist and send-ready outreach.'
  })()

  const topSignalType = args.momentum?.topSignalTypes?.[0]?.type ?? (args.signals[0]?.type ?? '')
  const whyNowCue = topSignalType
    ? `Noticed ${formatSignalType(topSignalType)} momentum`
    : args.momentum
      ? `Noticed ${args.momentum.label} momentum`
      : 'Noticed recent activity'

  const baseAngles: PersonaAngle[] = []

  // Baseline “account-first” roles (never named people).
  // We keep these heuristic and tie them to observed signal families.
  const hasHiring = Array.from(distinctTypes).some((t) => t.includes('new_hires') || t.includes('hiring') || t.includes('leadership_change'))
  const hasFunding = Array.from(distinctTypes).some((t) => t.includes('funding'))
  const hasLaunch = Array.from(distinctTypes).some((t) => t.includes('product_launch'))
  const hasPartnership = Array.from(distinctTypes).some((t) => t.includes('partnership'))
  const hasExpansion = Array.from(distinctTypes).some((t) => t.includes('expansion') || t.includes('market_expansion'))
  const hasRegulatory = Array.from(distinctTypes).some((t) => t.includes('regulatory') || t.includes('security'))

  const hasFirstParty = args.firstPartyVisitorCount14d > 0

  // Champion (operator) defaults.
  if (hasHiring || hasExpansion || hasFirstParty) {
    baseAngles.push({
      persona: 'Director RevOps',
      category: 'champion',
      priority: 1,
      whyRecommended: uniq([
        hasFirstParty ? 'First-party activity suggests active evaluation.' : null,
        hasHiring ? 'Hiring/enablement signals often trigger process and tooling changes.' : null,
        hasExpansion ? 'Expansion signals typically create routing and workflow changes.' : null,
      ].filter((x): x is string => Boolean(x))),
      whyNowAngle: hasFirstParty
        ? 'They’re showing up on your site. Use timing to ask a routing question and offer a short workflow.'
        : 'Use the detected signal to position a workflow upgrade: faster prioritization + consistent first touches.',
      likelyPain: 'Routing, prioritization, and standardizing outbound execution across reps.',
      openingDirection: 'Keep it short. Ask what is driving priority this week and offer a concrete workflow artifact.',
      suggestedFirstTouch: {
        channel: hasFirstParty ? 'linkedin_dm' : 'email',
        text: buildFirstTouch({ channel: hasFirstParty ? 'linkedin_dm' : 'email', companyName, persona: 'Director RevOps', whyNowCue, valueLine }),
      },
      limitations: hasFirstParty ? [] : ['No first-party visitor match—timing is based on detected signals only.'],
    })
  }

  // Economic buyer (leadership) based on funding/expansion.
  if (hasFunding || hasExpansion) {
    baseAngles.push({
      persona: 'VP Sales',
      category: 'economic_buyer',
      priority: baseAngles.length > 0 ? 2 : 1,
      whyRecommended: uniq([
        hasFunding ? 'Funding signals often map to pipeline urgency and execution focus.' : null,
        hasExpansion ? 'Expansion signals often map to growth targets and new segment coverage.' : null,
      ].filter((x): x is string => Boolean(x))),
      whyNowAngle: 'Position execution speed: why-now signals → daily shortlist → send-ready drafts.',
      likelyPain: 'Pipeline creation, rep execution consistency, and time wasted on low-signal accounts.',
      openingDirection: 'Lead with timing + prioritization, not features. Ask about their current outbound operating rhythm.',
      suggestedFirstTouch: {
        channel: 'email',
        text: buildFirstTouch({ channel: 'email', companyName, persona: 'VP Sales', whyNowCue, valueLine }),
      },
      limitations: ['These are persona-level recommendations (no named contact data).'],
    })
  }

  if (hasFunding) {
    baseAngles.push({
      persona: 'CRO',
      category: 'economic_buyer',
      priority: baseAngles.length > 0 ? 3 : 1,
      whyRecommended: ['Funding signals can indicate a near-term push for pipeline and process.'],
      whyNowAngle: 'Offer a lightweight “timing-first outbound” operating model: shortlist + explainable score + drafts.',
      likelyPain: 'Execution speed, prioritization, and consistent rep output without noise.',
      openingDirection: 'Ask one prioritization question and offer a concrete artifact (brief, shortlist, or first touch).',
      suggestedFirstTouch: {
        channel: 'email',
        text: buildFirstTouch({ channel: 'email', companyName, persona: 'CRO', whyNowCue, valueLine }),
      },
      limitations: ['Use cautious language—do not assume internal priorities beyond what signals support.'],
    })
  }

  // Evaluators based on launch/partnership/regulatory.
  if (hasLaunch) {
    baseAngles.push({
      persona: 'Product Marketing',
      category: 'evaluator',
      priority: baseAngles.length > 0 ? 3 : 1,
      whyRecommended: ['Product launch signals often change messaging, routing, and segment focus.'],
      whyNowAngle: 'Use “messaging under change” as the why-now: align targeting + opener to the new story.',
      likelyPain: 'Message-market alignment, segment definition, and sales messaging consistency.',
      openingDirection: 'Offer an angle library + first-touch variants tied to the launch positioning.',
      suggestedFirstTouch: {
        channel: hasFirstParty ? 'linkedin_dm' : 'email',
        text: buildFirstTouch({ channel: hasFirstParty ? 'linkedin_dm' : 'email', companyName, persona: 'Product Marketing', whyNowCue, valueLine }),
      },
      limitations: ['Do not claim specifics about the launch unless a cited signal supports it.'],
    })
  }

  if (hasPartnership) {
    baseAngles.push({
      persona: 'Partnerships',
      category: 'evaluator',
      priority: baseAngles.length > 0 ? 3 : 1,
      whyRecommended: ['Partnership signals suggest new routes-to-market and account routing questions.'],
      whyNowAngle: 'Position coordination: route-to-market changes benefit from timing-first account selection and packaged handoffs.',
      likelyPain: 'Routing leads, coordinating GTM motions, and avoiding missed timing windows.',
      openingDirection: 'Ask about routing and where partner-sourced accounts go today; offer a simple action-ready brief.',
      suggestedFirstTouch: {
        channel: 'email',
        text: buildFirstTouch({ channel: 'email', companyName, persona: 'Partnerships', whyNowCue, valueLine }),
      },
      limitations: ['Partnership teams vary; adjust if the signal is actually sales-led.'],
    })
  }

  if (hasRegulatory) {
    baseAngles.push({
      persona: 'Security',
      category: 'evaluator',
      priority: baseAngles.length > 0 ? 4 : 1,
      whyRecommended: ['Regulatory/security signals can change evaluation criteria and buyer scrutiny.'],
      whyNowAngle: 'Use trust visibility: explainable scoring + inspectable trust pages + controlled exports/webhooks.',
      likelyPain: 'Risk assessment, vendor review process, and clarity on data handling boundaries.',
      openingDirection: 'Offer a short trust checklist and ask what their review process requires.',
      suggestedFirstTouch: {
        channel: 'email',
        text: buildFirstTouch({ channel: 'email', companyName, persona: 'Security', whyNowCue, valueLine }),
      },
      limitations: ['Avoid compliance claims; point to inspectable trust pages only.'],
    })
  }

  // If evidence is thin, fall back to a minimal, explicitly heuristic set.
  if (baseAngles.length === 0) {
    baseAngles.push({
      persona: 'VP Sales',
      category: 'economic_buyer',
      priority: 1,
      whyRecommended: ['Account-level context is limited; start with a broad prioritization conversation.'],
      whyNowAngle: 'Use the most recent signals available and keep the ask narrow.',
      likelyPain: 'Prioritization and rep execution time wasted on low-signal accounts.',
      openingDirection: 'Ask a single routing/prioritization question and offer a lightweight next step.',
      suggestedFirstTouch: {
        channel: 'email',
        text: buildFirstTouch({ channel: 'email', companyName, persona: 'VP Sales', whyNowCue, valueLine }),
      },
      limitations: ['Source coverage is limited. Recommendations are heuristic and should be verified.'],
    })
  }

  const sorted = [...baseAngles].sort((a, b) => a.priority - b.priority || a.persona.localeCompare(b.persona))
  const topPersonas = uniq(sorted.map((x) => x.persona)).slice(0, 5)
  const champion = sorted.find((x) => x.category === 'champion')?.persona ?? null
  const economicBuyer = sorted.find((x) => x.category === 'economic_buyer')?.persona ?? null
  const evaluator = sorted.find((x) => x.category === 'evaluator')?.persona ?? null

  return {
    items: sorted,
    topPersonas,
    champion,
    economicBuyer,
    evaluator,
    evidence: {
      topSignalTypes: args.momentum?.topSignalTypes ?? [],
      mostRecentSignalAt: args.momentum?.mostRecentSignalAt ?? null,
      momentum: args.momentum ? { label: args.momentum.label, delta: args.momentum.delta } : null,
      firstPartyVisitorCount14d: args.firstPartyVisitorCount14d,
    },
    confidence: confidenceFromEvidence({ signalCount: args.signals.length, distinctSignalTypes: distinctTypes.size, firstPartyVisitorCount14d: args.firstPartyVisitorCount14d }),
  }
}

