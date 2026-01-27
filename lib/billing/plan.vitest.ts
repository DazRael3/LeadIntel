import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { getPlanDetails } from './plan'
import type { SupabaseClient } from '@supabase/supabase-js'

type SubRow = {
  status?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

type UserRow = {
  subscription_tier?: 'free' | 'pro' | null
  trial_ends_at?: string | null
}

function makeSupabaseMock(opts: { sub?: SubRow | null; user?: UserRow | null }) {
  return {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === 'subscriptions') {
            return { data: opts.sub ?? null, error: null }
          }
          if (table === 'users') {
            return { data: opts.user ?? null, error: null }
          }
          return { data: null, error: null }
        },
      }
      return chain
    },
  }
}

describe('getPlanDetails (app trial)', () => {
  const prev = process.env.ENABLE_APP_TRIAL

  beforeEach(() => {
    process.env.ENABLE_APP_TRIAL = 'true'
  })

  afterEach(() => {
    process.env.ENABLE_APP_TRIAL = prev
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

