import { describe, expect, it, vi, beforeEach } from 'vitest'
import { resolveTierFromDb } from './resolve-tier'

class FakeQuery {
  private table: string
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  then(onfulfilled: (v: any) => any, onrejected?: (e: unknown) => any) {
    const exec = async () => {
      if (this.table === 'subscriptions') {
        return { data: [], error: null }
      }
      if (this.table === 'qa_tier_overrides') {
        return { data: [], error: null }
      }
      return { data: [], error: null }
    }
    return exec().then(onfulfilled, onrejected)
  }
  maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    if (this.table === 'users') {
      return Promise.resolve({ data: null, error: null })
    }
    if (this.table === 'qa_tier_overrides') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

describe('resolveTierFromDb house override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HOUSE_CLOSER_EMAILS = ''
    process.env.ENABLE_QA_OVERRIDES = ''
    process.env.QA_OVERRIDE_TARGET_EMAILS = ''
  })

  it('session email in HOUSE_CLOSER_EMAILS returns closer without admin lookup', async () => {
    process.env.HOUSE_CLOSER_EMAILS = 'owner@dazrael.com'
    const getUserById = vi.fn(async () => ({ data: { user: { email: 'owner@dazrael.com' } }, error: null }))

    const admin = {
      from: (table: string) => new FakeQuery(table),
      auth: { admin: { getUserById } },
    } as unknown as Parameters<typeof resolveTierFromDb>[0]

    const res = await resolveTierFromDb(admin, 'user_1', 'owner@dazrael.com')
    expect(res.tier).toBe('closer')
    expect(res.plan).toBe('pro')
    expect(res.planId).toBe('pro')
    expect(res.isHouseCloserOverride).toBe(true)
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('admin email can trigger override as fallback when session email missing', async () => {
    process.env.HOUSE_CLOSER_EMAILS = 'owner@dazrael.com'
    const getUserById = vi.fn(async () => ({ data: { user: { email: 'owner@dazrael.com' } }, error: null }))

    const admin = {
      from: (table: string) => new FakeQuery(table),
      auth: { admin: { getUserById } },
    } as unknown as Parameters<typeof resolveTierFromDb>[0]

    const res = await resolveTierFromDb(admin, 'user_1', null)
    expect(res.tier).toBe('closer')
    expect(res.plan).toBe('pro')
    expect(res.planId).toBe('pro')
    expect(res.isHouseCloserOverride).toBe(true)
    expect(getUserById).toHaveBeenCalledWith('user_1')
  })
})

describe('resolveTierFromDb QA override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HOUSE_CLOSER_EMAILS = ''
    process.env.ENABLE_QA_OVERRIDES = 'true'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@dazrael.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@dazrael.com'
  })

  it('applies override tier for allowlisted internal users', async () => {
    class OverrideQuery extends FakeQuery {
      maybeSingle(): Promise<{ data: unknown; error: unknown }> {
        if (((this as unknown) as { table?: string }).table === 'qa_tier_overrides') {
          return Promise.resolve({ data: { override_tier: 'team', expires_at: null, revoked_at: null }, error: null })
        }
        return super.maybeSingle()
      }
    }

    const admin = {
      from: (table: string) => new OverrideQuery(table),
      auth: { admin: { getUserById: vi.fn() } },
    } as unknown as Parameters<typeof resolveTierFromDb>[0]

    const res = await resolveTierFromDb(admin, 'user_1', 'qa@dazrael.com')
    expect(res.tier).toBe('team')
    expect(res.isQaTierOverride).toBe(true)
    expect(res.qaOverride?.tier).toBe('team')
  })
})

