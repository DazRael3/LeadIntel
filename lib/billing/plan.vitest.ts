import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanDetails } from './plan'

type SubRow = {
  status?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

type UserRow = {
  subscription_tier?: 'free' | 'pro'
  trial_ends_at?: string | null
}

function makeSupabaseMock(opts: { sub: SubRow | null; user: UserRow | null }) {
  const from = (table: string) => {
    if (table === 'subscriptions') {
      const chain = {
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: opts.sub, error: null }),
      }
      return {
        select: () => ({
          eq: () => chain,
        }),
      }
    }
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: opts.user, error: null }),
          }),
        }),
      }
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }
  }

  return { from }
}

describe('getPlanDetails (app trial)', () => {
  const prev = process.env.ENABLE_APP_TRIAL

  beforeEach(() => {
    process.env.ENABLE_APP_TRIAL = 'true'
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_APP_TRIAL
    else process.env.ENABLE_APP_TRIAL = prev
  })

  it('treats user as pro when app trial is active and no Stripe subscription', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const supabase = makeSupabaseMock({
      sub: null,
      user: { subscription_tier: 'free', trial_ends_at: future },
    })
    const details = await getPlanDetails(supabase as unknown as SupabaseClient, 'user_1')
    expect(details.plan).toBe('pro')
    expect(details.isAppTrial).toBe(true)
    expect(details.appTrialEndsAt).toBe(future)
  })

  it('falls back to free when app trial is expired and no Stripe subscription', async () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const supabase = makeSupabaseMock({
      sub: null,
      user: { subscription_tier: 'free', trial_ends_at: past },
    })
    const details = await getPlanDetails(supabase as unknown as SupabaseClient, 'user_1')
    expect(details.plan).toBe('free')
    expect(details.isAppTrial).toBe(false)
  })
})

