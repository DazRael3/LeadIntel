import type { BuyingGroupRecommendation, PersonaRecommendationSummary, PersonaRole } from '@/lib/domain/people'

function uniq(items: PersonaRole[]): PersonaRole[] {
  const out: PersonaRole[] = []
  for (const x of items) if (!out.includes(x)) out.push(x)
  return out
}

export function deriveBuyingGroup(rec: PersonaRecommendationSummary): BuyingGroupRecommendation {
  const champion = rec.champion
  const economicBuyer = rec.economicBuyer
  const evaluator = rec.evaluator

  const priorityOrder = uniq(
    [
      champion,
      economicBuyer,
      evaluator,
      ...rec.items
        .filter((i) => i.category === 'influencer')
        .sort((a, b) => a.priority - b.priority)
        .map((i) => i.persona),
      ...rec.topPersonas,
    ].filter((x): x is PersonaRole => Boolean(x))
  ).slice(0, 6)

  const influencers = uniq(
    rec.items
      .filter((i) => i.category === 'influencer')
      .sort((a, b) => a.priority - b.priority)
      .map((i) => i.persona)
  ).slice(0, 4)

  const rationale: Record<string, string[]> = {}
  for (const item of rec.items) {
    rationale[item.persona] = item.whyRecommended.length > 0 ? item.whyRecommended : ['Recommended based on available signals.']
  }

  const limitations: string[] = []
  if (rec.confidence === 'limited') {
    limitations.push('Source coverage is limited—treat this as a heuristic buying-group outline, not a fact.')
  } else {
    limitations.push('These are persona-level recommendations (no named contacts).')
  }

  return {
    champion,
    economicBuyer,
    evaluator,
    influencers,
    priorityOrder,
    rationale,
    confidence: rec.confidence,
    limitations,
  }
}

