import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'
import type { DataQualitySummary } from '@/lib/domain/data-quality'
import type { SourceHealthSummary } from '@/lib/domain/source-health'

export type PayloadVersion = 1

export type HandoffCommon = {
  version: PayloadVersion
  generatedAt: string
  account: {
    id: string
    companyName: string
    companyDomain: string | null
    companyUrl: string | null
    score: number
    momentum: { label: string; delta: number } | null
  }
  whyNow: {
    summary: string
    topSignals: Array<{ title: string; detectedAt: string; sourceUrl: string | null }>
  }
  people: {
    recommendedPersonas: Array<{ persona: string; category: string; whyNowAngle: string; suggestedFirstTouch: string }>
    championPersona: string | null
    economicBuyerPersona: string | null
  }
  quality: {
    dataQuality: Pick<DataQualitySummary, 'quality' | 'freshness' | 'limitations'>
    sourceHealth: Pick<SourceHealthSummary, 'freshness' | 'lastSignalAt' | 'lastFirstPartyAt' | 'notes'>
  }
  links: {
    leadintelAccountUrl: string | null
  }
}

export type CrmHandoffPayload = HandoffCommon & {
  kind: 'crm_handoff'
  crm: {
    mode: 'account_push' | 'task' | 'note'
    taskTitle: string
    noteTitle: string
    body: string
  }
}

export type SequencerHandoffPayload = HandoffCommon & {
  kind: 'sequencer_handoff'
  sequencer: {
    sequenceNameSuggestion: string
    targetPersona: string | null
    opener: string | null
    followupAngle: string | null
    internalNote: string
    limitationsNote: string | null
  }
}

function safeLinkBase(): string | null {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (!base) return null
  try {
    const u = new URL(base)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.origin
  } catch {
    return null
  }
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

function peopleSummary(personas: PersonaRecommendationSummary | null | undefined): {
  recommendedPersonas: Array<{ persona: string; category: string; whyNowAngle: string; suggestedFirstTouch: string }>
  championPersona: string | null
  economicBuyerPersona: string | null
} {
  const items = (personas?.items ?? []).slice(0, 5)
  const recommendedPersonas = items.map((i) => ({
    persona: i.persona,
    category: i.category,
    whyNowAngle: truncate(i.whyNowAngle, 200),
    suggestedFirstTouch: truncate(i.suggestedFirstTouch.text, 220),
  }))
  const championPersona = personas?.champion ?? null
  const economicBuyerPersona = personas?.economicBuyer ?? null
  return { recommendedPersonas, championPersona, economicBuyerPersona }
}

function buildWhyNow(ex: AccountExplainability, maxSignals: number): HandoffCommon['whyNow'] {
  const topSignals = ex.signals.slice(0, maxSignals).map((s) => ({
    title: truncate(s.title, 140),
    detectedAt: s.detectedAt,
    sourceUrl: s.sourceUrl ?? null,
  }))
  const summaryLines: string[] = []
  summaryLines.push(`Score: ${ex.scoreExplainability.score}/100`)
  if (ex.momentum) summaryLines.push(`Momentum: ${ex.momentum.label} (${ex.momentum.delta >= 0 ? '+' : ''}${ex.momentum.delta})`)
  for (const t of topSignals.slice(0, 3)) summaryLines.push(`Signal: ${t.title}`)
  return { summary: summaryLines.join('\n'), topSignals }
}

function common(args: {
  explainability: AccountExplainability
  companyName: string
}): Omit<HandoffCommon, 'whyNow'> & { whyNow: HandoffCommon['whyNow'] } {
  const ex = args.explainability
  const base = safeLinkBase()
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    account: {
      id: ex.account.id,
      companyName: args.companyName,
      companyDomain: ex.account.domain,
      companyUrl: ex.account.url,
      score: ex.scoreExplainability.score,
      momentum: ex.momentum ? { label: ex.momentum.label, delta: ex.momentum.delta } : null,
    },
    whyNow: buildWhyNow(ex, 6),
    people: peopleSummary(ex.people?.personas),
    quality: {
      dataQuality: {
        quality: ex.dataQuality.quality,
        freshness: ex.dataQuality.freshness,
        limitations: ex.dataQuality.limitations,
      },
      sourceHealth: {
        freshness: ex.sourceHealth.freshness,
        lastSignalAt: ex.sourceHealth.lastSignalAt,
        lastFirstPartyAt: ex.sourceHealth.lastFirstPartyAt,
        notes: ex.sourceHealth.notes,
      },
    },
    links: {
      leadintelAccountUrl: base ? `${base}/dashboard?lead=${encodeURIComponent(ex.account.id)}` : null,
    },
  }
}

export function buildCrmHandoffPayload(args: {
  explainability: AccountExplainability
  companyName: string
  mode: CrmHandoffPayload['crm']['mode']
  briefReportId?: string | null
}): CrmHandoffPayload {
  const c = common({ explainability: args.explainability, companyName: args.companyName })

  const bulletSignals = c.whyNow.topSignals.slice(0, 5).map((s) => `- ${s.title}`).join('\n')
  const personas = c.people.recommendedPersonas
    .map((p) => `- ${p.persona} (${p.category}): ${p.whyNowAngle}`)
    .join('\n')
  const briefLine = args.briefReportId ? `Brief report id: ${args.briefReportId}` : 'Brief: not saved yet'

  const body = [
    `Account: ${c.account.companyName}`,
    c.account.companyDomain ? `Domain: ${c.account.companyDomain}` : null,
    c.account.companyUrl ? `URL: ${c.account.companyUrl}` : null,
    `Score: ${c.account.score}/100`,
    c.account.momentum ? `Momentum: ${c.account.momentum.label} (${c.account.momentum.delta >= 0 ? '+' : ''}${c.account.momentum.delta})` : null,
    '',
    'Why now',
    bulletSignals || '- —',
    '',
    'Recommended personas',
    personas || '- —',
    '',
    'Quality / limitations',
    c.quality.dataQuality.limitations.length > 0 ? c.quality.dataQuality.limitations.map((x) => `- ${x}`).join('\n') : '- Coverage looks healthy',
    '',
    briefLine,
    c.links.leadintelAccountUrl ? `LeadIntel: ${c.links.leadintelAccountUrl}` : null,
  ]
    .filter((x): x is string => typeof x === 'string')
    .join('\n')

  return {
    ...c,
    kind: 'crm_handoff',
    crm: {
      mode: args.mode,
      taskTitle: `LeadIntel: follow up on ${c.account.companyName}`,
      noteTitle: `LeadIntel handoff: ${c.account.companyName}`,
      body: truncate(body, 4000),
    },
  }
}

export function buildSequencerHandoffPayload(args: {
  explainability: AccountExplainability
  companyName: string
  opener: string | null
  followupAngle: string | null
  targetPersona: string | null
}): SequencerHandoffPayload {
  const c = common({ explainability: args.explainability, companyName: args.companyName })

  const limitationsNote =
    c.quality.dataQuality.quality === 'limited' || c.quality.dataQuality.limitations.length > 0
      ? `Limitations: ${truncate(c.quality.dataQuality.limitations.join(' '), 220)}`
      : null

  const internalNote = truncate(
    [
      `Why now: ${c.whyNow.topSignals[0]?.title ?? '—'}`,
      c.account.momentum ? `Momentum: ${c.account.momentum.label} (${c.account.momentum.delta >= 0 ? '+' : ''}${c.account.momentum.delta})` : null,
      args.targetPersona ? `Target persona: ${args.targetPersona}` : null,
    ]
      .filter((x): x is string => typeof x === 'string')
      .join(' · '),
    280
  )

  return {
    ...c,
    kind: 'sequencer_handoff',
    sequencer: {
      sequenceNameSuggestion: `LeadIntel: ${c.account.companyName} (${c.account.momentum?.label ?? 'signals'})`,
      targetPersona: args.targetPersona,
      opener: args.opener ? truncate(args.opener, 900) : null,
      followupAngle: args.followupAngle ? truncate(args.followupAngle, 220) : null,
      internalNote,
      limitationsNote,
    },
  }
}

