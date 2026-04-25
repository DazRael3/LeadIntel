import type { Tier } from '@/lib/billing/tier'

export type ProductPlan = 'free' | 'pro' | 'agency'

export type ProductPlanDetails = {
  plan: ProductPlan
  label: string
  leadGenerationLimit: number | null
  aiPitchLimit: number | null
  exportsEnabled: boolean
  campaignAutomationEnabled: boolean
}

const PRODUCT_PLAN_BY_TIER: Record<Tier, ProductPlan> = {
  starter: 'free',
  closer: 'pro',
  closer_plus: 'pro',
  team: 'agency',
}

const PRODUCT_PLAN_DETAILS: Record<ProductPlan, ProductPlanDetails> = {
  free: {
    plan: 'free',
    label: 'Free',
    leadGenerationLimit: 3,
    aiPitchLimit: 10,
    exportsEnabled: false,
    campaignAutomationEnabled: false,
  },
  pro: {
    plan: 'pro',
    label: 'Pro',
    leadGenerationLimit: 250,
    aiPitchLimit: 300,
    exportsEnabled: true,
    campaignAutomationEnabled: true,
  },
  agency: {
    plan: 'agency',
    label: 'Agency',
    leadGenerationLimit: null,
    aiPitchLimit: null,
    exportsEnabled: true,
    campaignAutomationEnabled: true,
  },
}

export function productPlanForTier(tier: Tier): ProductPlan {
  return PRODUCT_PLAN_BY_TIER[tier]
}

export function getProductPlanDetailsForTier(tier: Tier): ProductPlanDetails {
  return PRODUCT_PLAN_DETAILS[productPlanForTier(tier)]
}

export function productPlanAtLeast(plan: ProductPlan, required: ProductPlan): boolean {
  const rank = (value: ProductPlan): number => {
    if (value === 'free') return 0
    if (value === 'pro') return 1
    return 2
  }
  return rank(plan) >= rank(required)
}
