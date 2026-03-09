import { describe, expect, test } from 'vitest'
import { recipeMatchesAccount } from '@/lib/services/action-recipes'
import type { ActionRecipeRow } from '@/lib/domain/action-recipes'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

function explainability(score: number, momentum: 'rising' | 'steady' | 'cooling', firstPartyCount: number, quality: 'limited' | 'usable' | 'strong'): AccountExplainability {
  return {
    account: { id: 'lead_1', name: 'Acme', domain: 'acme.com', url: 'https://acme.com', createdAt: null, updatedAt: null },
    signals: [],
    scoreExplainability: { score, summary: '', breakdown: { momentum: 0, intent: 0, fit: 0, timing: 0, volume: 0, diversity: 0, recency: 0, firstParty: 0 }, limitations: [] },
    momentum: { label: momentum, delta: momentum === 'rising' ? 10 : momentum === 'cooling' ? -10 : 0, recentEvents: 0, highSignalEvents: 0, mostRecentSignalAt: null },
    firstPartyIntent: { visitorMatches: { count: firstPartyCount, lastVisitedAt: null, sampleReferrers: [] }, summary: { label: 'none', labelText: 'No first-party intent yet', summary: '', freshnessDays: null } },
    dataQuality: {
      quality,
      freshness: 'unknown',
      lastObservedAt: null,
      coverage: { sourcesPresent: [], sourcesMissing: [], sourceCount: 0 },
      completeness: { hasSignals: false, hasScoreExplainability: true, hasMomentum: true, hasFirstPartyIntent: true, hasPeople: false },
      limitations: [],
      operatorNotes: [],
    },
    sourceHealth: { window: '30d', lastSignalAt: null, lastFirstPartyAt: null, freshness: 'unknown', notes: [] },
    people: {
      personas: { items: [], topPersonas: [], champion: null, economicBuyer: null, evaluator: null, evidence: { topSignalTypes: [], mostRecentSignalAt: null, momentum: null, firstPartyVisitorCount14d: 0 }, confidence: 'limited' },
      buyingGroup: { champion: null, economicBuyer: null, evaluator: null, influencers: [], priorityOrder: [], rationale: {}, confidence: 'limited', limitations: [] },
    },
  }
}

function recipe(conditions: ActionRecipeRow['conditions']): ActionRecipeRow {
  return {
    id: 'r1',
    workspace_id: 'w1',
    name: 'Test',
    trigger_type: 'manual_action',
    conditions,
    action_type: 'prepare_crm_handoff',
    destination_type: null,
    destination_id: null,
    is_enabled: true,
    created_by: 'u1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

describe('action-recipes', () => {
  test('matches score threshold', () => {
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'account_score_threshold', minScore: 70 }), explainability: explainability(72, 'steady', 0, 'usable') })).toBe(true)
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'account_score_threshold', minScore: 90 }), explainability: explainability(72, 'steady', 0, 'usable') })).toBe(false)
  })

  test('matches momentum state', () => {
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'momentum_state', state: 'rising' }), explainability: explainability(10, 'rising', 0, 'usable') })).toBe(true)
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'momentum_state', state: 'cooling' }), explainability: explainability(10, 'rising', 0, 'usable') })).toBe(false)
  })

  test('matches first-party intent state', () => {
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'first_party_intent_state', state: 'active' }), explainability: explainability(10, 'steady', 2, 'usable') })).toBe(true)
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'first_party_intent_state', state: 'inactive' }), explainability: explainability(10, 'steady', 2, 'usable') })).toBe(false)
  })

  test('matches data quality', () => {
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'data_quality', quality: 'limited' }), explainability: explainability(10, 'steady', 0, 'limited') })).toBe(true)
    expect(recipeMatchesAccount({ recipe: recipe({ type: 'data_quality', quality: 'strong' }), explainability: explainability(10, 'steady', 0, 'limited') })).toBe(false)
  })
})

