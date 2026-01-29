import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}))

vi.mock('@/lib/events/provider', () => ({
  getCompositeTriggerEventsProvider: vi.fn(),
}))

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCompositeTriggerEventsProvider } from '@/lib/events/provider'
import {
  ingestRealTriggerEvents,
  seedDemoTriggerEventsIfEmpty,
  type TriggerEventInput,
} from './triggerEvents'

type Row = { headline: string; detected_at: string; id?: string }

function makeAdminClientMock(args: {
  existing: Row[]
}) {
  const state = {
    existing: args.existing.slice(),
    inserted: [] as any[],
    filters: {} as Record<string, unknown>,
  }

  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn((k: string, v: unknown) => {
      state.filters[k] = v
      return chain
    }),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(async (rows: any[]) => {
      state.inserted.push(...rows)
      return { data: null, error: null }
    }),
    then: (onfulfilled: (value: any) => any, onrejected: (reason: any) => any) => {
      try {
        return Promise.resolve({ data: state.existing, error: null }).then(onfulfilled, onrejected)
      } catch (e) {
        return Promise.reject(e).then(onfulfilled, onrejected)
      }
    },
  }

  return {
    client: { from: vi.fn(() => chain) },
    state,
    chain,
  }
}

describe('triggerEvents service', () => {
  const input: TriggerEventInput = {
    userId: 'user_1',
    leadId: 'lead_1',
    companyName: 'Lego',
    companyDomain: 'lego.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ingestRealTriggerEvents resolves when provider returns []', async () => {
    ;(getCompositeTriggerEventsProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(async () => [])
    const res = await ingestRealTriggerEvents(input)
    expect(res.created).toBe(0)
    expect(createSupabaseAdminClient).not.toHaveBeenCalled()
  })

  it('ingestRealTriggerEvents inserts rows and dedupes by URL', async () => {
    const admin = makeAdminClientMock({
      existing: [{ headline: 'Existing', detected_at: '2026-01-01T00:00:00.000Z', source_url: 'https://example.com/a' } as any],
    })
    ;(createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(admin.client)
    ;(getCompositeTriggerEventsProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(async () => [
      { title: 'Dup', headline: 'Dup', sourceUrl: 'https://example.com/a', description: 'dup', occurredAt: new Date('2026-01-01T00:00:00.000Z') },
      { title: 'New', headline: 'New', sourceUrl: 'https://example.com/b', description: 'new', occurredAt: new Date('2026-01-02T00:00:00.000Z') },
      { title: 'New dup url', headline: 'New dup url', sourceUrl: 'https://example.com/b', description: 'new', occurredAt: new Date('2026-01-02T00:00:00.000Z') },
    ])

    const res = await ingestRealTriggerEvents(input)
    expect(res.created).toBe(1)
    expect(admin.state.inserted.length).toBe(1)
    expect(admin.state.inserted[0].source_url).toBe('https://example.com/b')
  })

  it('seedDemoTriggerEventsIfEmpty does not insert when events exist', async () => {
    const admin = makeAdminClientMock({
      existing: [{ headline: 'Existing', detected_at: '2026-01-01T00:00:00.000Z' }],
    })
    ;(createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(admin.client)

    const res = await seedDemoTriggerEventsIfEmpty(input)
    expect(res.created).toBe(0)
    expect(admin.chain.insert).not.toHaveBeenCalled()
  })
})

