import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isQaActorAllowed, isQaOverrideUiEnabled, isQaTargetAllowed } from './overrides'

describe('qa override allowlists', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.QA_OVERRIDE_ACTOR_EMAILS
    delete process.env.QA_OVERRIDE_TARGET_EMAILS
    delete process.env.ENABLE_QA_OVERRIDES
  })

  it('ENABLE_QA_OVERRIDES gates UI', () => {
    expect(isQaOverrideUiEnabled()).toBe(false)
    process.env.ENABLE_QA_OVERRIDES = 'true'
    expect(isQaOverrideUiEnabled()).toBe(true)
  })

  it('defaults to @dazrael.com only when allowlists unset', () => {
    expect(isQaActorAllowed('a@dazrael.com')).toBe(true)
    expect(isQaTargetAllowed('b@dazrael.com')).toBe(true)
    expect(isQaActorAllowed('x@gmail.com')).toBe(false)
    expect(isQaTargetAllowed('x@gmail.com')).toBe(false)
  })

  it('respects explicit allowlists when set', () => {
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'target@corp.com'
    expect(isQaActorAllowed('actor@corp.com')).toBe(true)
    expect(isQaActorAllowed('a@dazrael.com')).toBe(false)
    expect(isQaTargetAllowed('target@corp.com')).toBe(true)
    expect(isQaTargetAllowed('b@dazrael.com')).toBe(false)
  })
})

