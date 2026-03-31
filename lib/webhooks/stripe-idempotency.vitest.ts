import { describe, expect, it } from 'vitest'

describe('stripe idempotency', () => {
  it('treats unique-violation insert errors as duplicate', async () => {
    const { recordStripeWebhookEventIfFirst } = await import('./stripe-idempotency')
    const res = await recordStripeWebhookEventIfFirst({
      admin: {
        schema: () => ({
          from: () => ({
            insert: async () => ({ data: null, error: { message: 'duplicate key value violates unique constraint' } }),
          }),
        }),
      } as never,
      stripeEventId: 'evt_1',
      type: 'x',
      livemode: false,
      payload: { id: 'evt_1' },
    })
    expect(res).toBe('duplicate')
  })

  it('returns first when insert succeeds', async () => {
    const { recordStripeWebhookEventIfFirst } = await import('./stripe-idempotency')
    const res = await recordStripeWebhookEventIfFirst({
      admin: {
        schema: () => ({
          from: () => ({
            insert: async () => ({ data: { id: 'row_1' }, error: null }),
          }),
        }),
      } as never,
      stripeEventId: 'evt_1',
      type: 'x',
      livemode: false,
      payload: { id: 'evt_1' },
    })
    expect(res).toBe('first')
  })
})

