import { describe, expect, it } from 'vitest'
import { getLifecycleStopReason, selectLifecycleStep } from '@/lib/lifecycle/policy'

describe('lifecycle policy', () => {
  it('stops on opted out', () => {
    const reason = getLifecycleStopReason({
      productTipsOptIn: false,
      hasBouncedEmail: false,
      upgraded: false,
      upgradeConfirmSentAt: null,
    })
    expect(reason).toBe('opted_out')
  })

  it('stops on bounced email', () => {
    const reason = getLifecycleStopReason({
      productTipsOptIn: true,
      hasBouncedEmail: true,
      upgraded: false,
      upgradeConfirmSentAt: null,
    })
    expect(reason).toBe('bounced')
  })

  it('stops after conversion confirmation sent', () => {
    const reason = getLifecycleStopReason({
      productTipsOptIn: true,
      hasBouncedEmail: false,
      upgraded: true,
      upgradeConfirmSentAt: '2026-04-01T00:00:00.000Z',
    })
    expect(reason).toBe('converted')
  })

  it('does not stop upgraded users before confirmation', () => {
    const reason = getLifecycleStopReason({
      productTipsOptIn: true,
      hasBouncedEmail: false,
      upgraded: true,
      upgradeConfirmSentAt: null,
    })
    expect(reason).toBeNull()
  })

  it('picks 3-day recap and 7-day winback, no 14-day branch', () => {
    const recap = selectLifecycleStep({
      state: { welcome_sent_at: '2026-04-01T00:00:00.000Z' },
      hoursSinceSignup: 72,
      daysSinceSignup: 3,
      accountsCount: 15,
      pitchesCount: 2,
      activated: true,
      upgraded: false,
      premiumUsed: 0,
      premiumDays: null,
      starterLimit: 3,
    })
    expect(recap).toEqual({ type: 'value_recap', field: 'value_recap_sent_at' })

    const winback = selectLifecycleStep({
      state: {
        welcome_sent_at: '2026-04-01T00:00:00.000Z',
        nudge_accounts_sent_at: '2026-04-01T06:00:00.000Z',
        nudge_pitch_sent_at: '2026-04-02T00:00:00.000Z',
      },
      hoursSinceSignup: 7 * 24,
      daysSinceSignup: 7,
      accountsCount: 0,
      pitchesCount: 0,
      activated: false,
      upgraded: false,
      premiumUsed: 0,
      premiumDays: null,
      starterLimit: 3,
    })
    expect(winback).toEqual({ type: 'winback', field: 'winback_sent_at' })
  })
})
