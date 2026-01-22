import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertedEmailLogs: unknown[] = []

class FakeQuery<T = unknown> {
  private table: string
  private state: {
    eq: Record<string, unknown>
    notNull: Set<string>
    gte: Record<string, string>
    limitCount?: number
    orderBy?: { column: string; ascending: boolean }
    selectArgs?: unknown[]
    insertRows?: unknown
    updatePatch?: unknown
    mode?: 'maybeSingle'
  } = { eq: {}, notNull: new Set(), gte: {} }

  constructor(table: string) {
    this.table = table
  }

  select(...args: unknown[]) {
    this.state.selectArgs = args
    return this
  }
  eq(column: string, value: unknown) {
    this.state.eq[column] = value
    return this
  }
  not(column: string, op: string, value: unknown) {
    if (op === 'is' && value === null) this.state.notNull.add(column)
    return this
  }
  gte(column: string, value: string) {
    this.state.gte[column] = value
    return this
  }
  order(column: string, opts: { ascending: boolean }) {
    this.state.orderBy = { column, ascending: opts.ascending }
    return this
  }
  limit(n: number) {
    this.state.limitCount = n
    return this
  }
  maybeSingle() {
    this.state.mode = 'maybeSingle'
    return this
  }
  insert(rows: unknown) {
    this.state.insertRows = rows
    return this
  }
  update(patch: unknown) {
    this.state.updatePatch = patch
    return this
  }

  private async execute(): Promise<any> {
    if (this.table === 'users') {
      if (this.state.eq.subscription_tier === 'pro') {
        return { data: [{ id: 'user_1' }], error: null }
      }
      return { data: [], error: null }
    }

    if (this.table === 'user_settings') {
      if (this.state.mode === 'maybeSingle') {
        return { data: { sender_name: 'Alice', from_email: 'alice@example.com' }, error: null }
      }
      return { data: null, error: null }
    }

    if (this.table === 'leads') {
      return {
        data: [
          {
            id: 'lead_1',
            company_name: 'Acme Co',
            contact_email: 'ceo@acme.co',
            ai_personalized_pitch: 'Hello from LeadIntel.',
            email_sequence: { part1: 'P1', part2: 'P2', part3: 'P3' },
          },
        ],
        error: null,
      }
    }

    if (this.table === 'email_logs') {
      // Count query
      const selectArgs = this.state.selectArgs
      if (Array.isArray(selectArgs) && typeof selectArgs[1] === 'object' && selectArgs[1] && 'count' in (selectArgs[1] as any)) {
        return { data: null, error: null, count: 0 }
      }

      // maybeSingle "last log" query
      if (this.state.mode === 'maybeSingle') {
        return { data: null, error: null }
      }

      // Insert logging
      if (this.state.insertRows) {
        insertedEmailLogs.push(this.state.insertRows)
        return { data: null, error: null }
      }

      return { data: null, error: null }
    }

    return { data: null, error: null }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => new FakeQuery(table),
  })),
}))

vi.mock('@/lib/email/resend', () => ({
  sendEmailWithResend: vi.fn(async () => ({ ok: true, messageId: 'email_123' })),
}))

describe('/api/autopilot/run', () => {
  beforeEach(() => {
    insertedEmailLogs.splice(0, insertedEmailLogs.length)
    vi.clearAllMocks()
  })

  it('returns a structured envelope and records a dry-run send attempt', async () => {
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/autopilot/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true, limitUsers: 1, limitLeadsPerUser: 1 }),
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'test-cron-secret-123456',
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toHaveProperty('ok', true)
    expect(json.data).toHaveProperty('emailsAttempted')
    expect(json.data).toHaveProperty('successfulSends')

    // Ensure at least one log attempt was recorded
    expect(insertedEmailLogs.length).toBeGreaterThan(0)
  })
})

