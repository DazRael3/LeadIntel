import { describe, expect, it, vi, beforeEach } from 'vitest'

type SelectResult = { data: unknown[] | null; error: null | { message: string }; count?: number | null }

function makeCountQuery(count: number) {
  const chain: any = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    not: vi.fn(() => chain),
    like: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (onfulfilled: (value: SelectResult) => any) => Promise.resolve({ data: null, error: null, count }).then(onfulfilled),
  }
  return chain
}

function makeRowsQuery(rows: Array<Record<string, unknown>>) {
  const chain: any = {
    select: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    not: vi.fn(() => chain),
    like: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (onfulfilled: (value: SelectResult) => any) => Promise.resolve({ data: rows, error: null }).then(onfulfilled),
  }
  return chain
}

function makeUpsertSingle(row: Record<string, unknown>) {
  const chain: any = {
    upsert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: row, error: null })),
  }
  return chain
}

const fromMock = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
  }),
}))

describe('siteReports service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generateDailySiteReport returns expected summary shape', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'users') return makeCountQuery(3)
      if (table === 'pitches') return makeCountQuery(5)
      if (table === 'trigger_events') return makeCountQuery(7)
      if (table === 'product_analytics') return makeCountQuery(11)
      return makeCountQuery(0)
    })

    // Distinct user-id queries:
    fromMock.mockImplementationOnce(() => makeCountQuery(3)) // users count
    fromMock.mockImplementationOnce(() => makeCountQuery(3)) // trials started (count)
    fromMock.mockImplementationOnce(() => makeCountQuery(5)) // pitches count
    fromMock.mockImplementationOnce(() => makeCountQuery(7)) // trigger events count
    fromMock.mockImplementationOnce(() => makeCountQuery(11)) // watchlist actions count
    fromMock.mockImplementationOnce(() => makeRowsQuery([{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u1' }])) // pitches users
    fromMock.mockImplementationOnce(() => makeRowsQuery([{ user_id: 'u2' }, { user_id: 'u3' }])) // analytics users

    const { generateDailySiteReport } = await import('./siteReports')
    const r = await generateDailySiteReport(new Date('2026-01-30T12:00:00.000Z'))
    expect(r.reportDate.toISOString()).toBe('2026-01-30T00:00:00.000Z')
    expect(r.summary).toEqual({
      signups: 3,
      trials_started: 3,
      active_users: 3,
      pitches_generated: 5,
      trigger_events_ingested: 7,
      watchlist_actions: 11,
    })
  })

  it('upsertDailySiteReport upserts by report_date', async () => {
    const upserted: unknown[] = []
    fromMock.mockImplementation((table: string) => {
      if (table !== 'site_reports') return makeCountQuery(0)
      return {
        upsert: (row: unknown) => {
          upserted.push(row)
          return makeUpsertSingle({ id: 'r1', report_date: '2026-01-30', generated_at: 't', summary: {}, notes: null })
        },
      }
    })

    const { upsertDailySiteReport } = await import('./siteReports')
    await upsertDailySiteReport({
      reportDate: new Date('2026-01-30T09:00:00.000Z'),
      summary: {
        signups: 1,
        trials_started: 0,
        active_users: 0,
        pitches_generated: 0,
        trigger_events_ingested: 0,
        watchlist_actions: 0,
      },
      notes: 'a',
    })
    await upsertDailySiteReport({
      reportDate: new Date('2026-01-30T11:00:00.000Z'),
      summary: {
        signups: 2,
        trials_started: 0,
        active_users: 0,
        pitches_generated: 0,
        trigger_events_ingested: 0,
        watchlist_actions: 0,
      },
      notes: 'b',
    })
    expect(upserted.length).toBe(2)
    expect(upserted[0]).toMatchObject({ report_date: '2026-01-30' })
    expect(upserted[1]).toMatchObject({ report_date: '2026-01-30' })
  })
})

