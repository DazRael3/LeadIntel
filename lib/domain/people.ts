import type { SignalMomentum } from '@/lib/domain/explainability'

export type PersonaRole =
  | 'VP Sales'
  | 'CRO'
  | 'Head of Growth'
  | 'Director RevOps'
  | 'Sales Enablement'
  | 'Demand Gen'
  | 'Product Marketing'
  | 'Partnerships'
  | 'Security'
  | 'Engineering'

export type PersonaCategory = 'champion' | 'economic_buyer' | 'evaluator' | 'influencer'

export type PersonaFirstTouchChannel = 'email' | 'linkedin_dm' | 'call'

export type PersonaAngle = {
  persona: PersonaRole
  category: PersonaCategory
  priority: number // 1 = first to contact
  whyRecommended: string[]
  whyNowAngle: string
  likelyPain: string
  openingDirection: string
  suggestedFirstTouch: {
    channel: PersonaFirstTouchChannel
    text: string
  }
  limitations: string[]
}

export type PersonaRecommendationSummary = {
  items: PersonaAngle[]
  topPersonas: PersonaRole[]
  champion: PersonaRole | null
  economicBuyer: PersonaRole | null
  evaluator: PersonaRole | null
  evidence: {
    topSignalTypes: Array<{ type: string; count: number }>
    mostRecentSignalAt: string | null
    momentum: { label: SignalMomentum['label']; delta: number } | null
    firstPartyVisitorCount14d: number
  }
  confidence: 'limited' | 'usable' | 'strong'
}

export type BuyingGroupConfidence = 'limited' | 'usable' | 'strong'

export type BuyingGroupRecommendation = {
  champion: PersonaRole | null
  economicBuyer: PersonaRole | null
  evaluator: PersonaRole | null
  influencers: PersonaRole[]
  priorityOrder: PersonaRole[]
  rationale: Record<string, string[]>
  confidence: BuyingGroupConfidence
  limitations: string[]
}

