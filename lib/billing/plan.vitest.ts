import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPlanDetails, isPro } from './plan'

type SubRow = {
  status?: string | null
  trial_end?: string | null
  current_period_end?: string | null
}

type UserRow = {
  subscription_tier?: 'free' | 'pro'
  trial_ends_at?: string | null
}

function makeSupabaseMock(opts: { sub: SubRow | null; user: UserRow | null; sessionEmail?: string | null }) {
  const from = vi.fn((table: string) => {
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
  })

  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { email: opts.sessionEmail ?? null } }, error: null })),
  }

  return { from, auth }
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

  it('keeps user on free plan when app trial is active and no Stripe subscription', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const supabase = makeSupabaseMock({
      sub: null,
      user: { subscription_tier: 'free', trial_ends_at: future },
    })
    const details = await getPlanDetails(supabase as unknown as SupabaseClient, 'user_1')
    expect(details.plan).toBe('free')
    expect(details.isAppTrial).toBe(true)
    expect(details.appTrialEndsAt).toBe(future)
  })

  it('does not treat app trial as pro access in isPro()', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const supabase = makeSupabaseMock({
      sub: null,
      user: { subscription_tier: 'free', trial_ends_at: future },
    })
    const pro = await isPro(supabase as unknown as SupabaseClient, 'user_1')
    expect(pro).toBe(false)
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

describe('getPlanDetails (house closer emails)', () => {
  const prev = process.env.HOUSE_CLOSER_EMAILS

  afterEach(() => {
    if (prev === undefined) delete process.env.HOUSE_CLOSER_EMAILS
    else process.env.HOUSE_CLOSER_EMAILS = prev
  })

  it('early-returns pro when session email is in HOUSE_CLOSER_EMAILS (no DB reads)', async () => {
    process.env.HOUSE_CLOSER_EMAILS = 'house@example.com'
    const supabase = makeSupabaseMock({ sub: null, user: null, sessionEmail: 'house@example.com' })

    const details = await getPlanDetails(supabase as unknown as SupabaseClient, 'user_1')
    expect(details.plan).toBe('pro')
    expect(details.planId).toBe('pro')
    expect(details.isAppTrial).toBe(false)
    expect(details.appTrialEndsAt).toBe(null)
    expect((supabase as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled()

    const pro = await isPro(supabase as unknown as SupabaseClient, 'user_1')
    expect(pro).toBe(true)
  })
})

