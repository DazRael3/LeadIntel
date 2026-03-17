import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getQaOverrideConfig, isQaActorAllowed, isQaOverrideUiEnabled, isQaTargetAllowed } from './overrides'

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

  it('fails closed when enabled but allowlists missing', () => {
    process.env.ENABLE_QA_OVERRIDES = 'true'
    const cfg = getQaOverrideConfig()
    expect(cfg.enabled).toBe(true)
    expect(cfg.configured).toBe(false)
    expect(isQaActorAllowed('a@dazrael.com')).toBe(false)
    expect(isQaTargetAllowed('b@dazrael.com')).toBe(false)
  })

  it('respects explicit allowlists when set', () => {
    process.env.ENABLE_QA_OVERRIDES = 'true'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'target@corp.com'
    expect(isQaActorAllowed('actor@corp.com')).toBe(true)
    expect(isQaActorAllowed('a@dazrael.com')).toBe(false)
    expect(isQaTargetAllowed('target@corp.com')).toBe(true)
    expect(isQaTargetAllowed('b@dazrael.com')).toBe(false)
  })

  it('trims whitespace and matches case-insensitively', () => {
    process.env.ENABLE_QA_OVERRIDES = 'true'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = ' LeadIntel4Unity4All@dazrael.com , OTHER@dazrael.com '
    process.env.QA_OVERRIDE_TARGET_EMAILS = ' qa-team@dazrael.com '
    expect(isQaActorAllowed('leadintel4unity4all@dazrael.com')).toBe(true)
    expect(isQaActorAllowed('Other@dazrael.com')).toBe(true)
    expect(isQaTargetAllowed('QA-TEAM@dazrael.com')).toBe(true)
  })
})

