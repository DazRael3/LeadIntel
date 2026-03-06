import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logProductEvent } from './analytics'

type InsertResult = { data: null; error: null }
const insertMock = vi.fn(async (): Promise<InsertResult> => ({ data: null, error: null }))
const fromMock = vi.fn(() => ({ insert: insertMock }))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
  }),
}))

describe('logProductEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts event payload (best-effort)', async () => {
    await logProductEvent({ userId: 'u1', eventName: 'pitch_generated', eventProps: { a: 1 } })
    expect(fromMock).toHaveBeenCalledWith('product_analytics')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        event_name: 'pitch_generated',
      })
    )
  })

  it('swallows errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fromMock.mockReturnValueOnce({
      insert: vi.fn(async (): Promise<InsertResult> => {
        throw new Error('db down')
      }),
    })
    await logProductEvent({ userId: 'u1', eventName: 'x' })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

