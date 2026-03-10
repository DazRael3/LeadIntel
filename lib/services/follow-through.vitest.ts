import { describe, expect, test } from 'vitest'
import { deriveFollowThroughLabel } from '@/lib/services/follow-through'

describe('follow-through', () => {
  test('blocked when failed or blocked', () => {
    const res = deriveFollowThroughLabel({
      momentumLabel: 'rising',
      freshness: 'fresh',
      hasReadyPrepared: false,
      hasQueuedOrProcessing: false,
      hasFailedOrBlocked: true,
      hasManualReview: false,
    })
    expect(res.label).toBe('blocked')
  })

  test('needs follow-through when prepared exists', () => {
    const res = deriveFollowThroughLabel({
      momentumLabel: 'rising',
      freshness: 'recent',
      hasReadyPrepared: true,
      hasQueuedOrProcessing: false,
      hasFailedOrBlocked: false,
      hasManualReview: false,
    })
    expect(res.label).toBe('needs_follow_through')
  })

  test('wait when cooling/stale with no actions', () => {
    const res = deriveFollowThroughLabel({
      momentumLabel: 'cooling',
      freshness: 'stale',
      hasReadyPrepared: false,
      hasQueuedOrProcessing: false,
      hasFailedOrBlocked: false,
      hasManualReview: false,
    })
    expect(res.label).toBe('waiting_on_stronger_signal')
  })
})

