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
      return { data: [], error: null }
    }
    return exec().then(onfulfilled, onrejected)
  }
  maybeSingle() {
    if (this.table === 'users') {
      return Promise.resolve({ data: null, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

describe('resolveTierFromDb house override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HOUSE_CLOSER_EMAILS = ''
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

