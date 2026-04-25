import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logProductEvent } from '@/lib/services/analytics'

const UserIdSchema = z.string().uuid()

export type ReferralClaimResult = {
  rewarded: boolean
  reason: 'rewarded' | 'invalid_referrer' | 'self_referral' | 'already_rewarded' | 'referrer_not_found' | 'error'
}

type ProductAnalyticsRow = {
  id: string
}

type UserCreditRow = {
  id: string
  credits_remaining: number | null
}

export async function claimReferralReward(args: {
  referredUserId: string
  referrerId: string
  bonusLeads?: number
}): Promise<ReferralClaimResult> {
  const referredId = args.referredUserId.trim()
  const referrerId = args.referrerId.trim()
  const bonusLeads = typeof args.bonusLeads === 'number' ? Math.max(1, Math.floor(args.bonusLeads)) : 10

  if (!UserIdSchema.safeParse(referrerId).success) {
    return { rewarded: false, reason: 'invalid_referrer' }
  }
  if (referredId === referrerId) {
    return { rewarded: false, reason: 'self_referral' }
  }

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })

    const { data: existingClaims, error: existingError } = await admin
      .from('product_analytics')
      .select('id')
      .eq('user_id', referredId)
      .eq('event_name', 'referral_signup_rewarded')
      .limit(1)

    if (existingError) {
      throw existingError
    }

    const existing = (existingClaims ?? []) as ProductAnalyticsRow[]
    if (existing.length > 0) {
      return { rewarded: false, reason: 'already_rewarded' }
    }

    const { data: referrerRow, error: referrerError } = await admin
      .schema('api')
      .from('users')
      .select('id, credits_remaining')
      .eq('id', referrerId)
      .maybeSingle()

    if (referrerError) {
      throw referrerError
    }

    const referrer = (referrerRow ?? null) as UserCreditRow | null
    if (!referrer) {
      return { rewarded: false, reason: 'referrer_not_found' }
    }

    const nextCredits = (typeof referrer.credits_remaining === 'number' ? referrer.credits_remaining : 0) + bonusLeads
    const { error: updateError } = await admin
      .schema('api')
      .from('users')
      .update({ credits_remaining: nextCredits })
      .eq('id', referrer.id)

    if (updateError) {
      throw updateError
    }

    await logProductEvent({
      userId: referredId,
      eventName: 'referral_signup_rewarded',
      eventProps: { referrerId: referrer.id, bonusLeads },
    })

    await logProductEvent({
      userId: referrer.id,
      eventName: 'referral_reward_earned',
      eventProps: { referredUserId: referredId, bonusLeads },
    })

    return { rewarded: true, reason: 'rewarded' }
  } catch {
    return { rewarded: false, reason: 'error' }
  }
}
