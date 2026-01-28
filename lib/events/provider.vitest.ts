import { describe, expect, it } from 'vitest'
import { getTriggerEventsProvider } from './provider'

describe('trigger events provider registry', () => {
  it('unknown provider falls back to none', async () => {
    process.env.TRIGGER_EVENTS_PROVIDER = 'wat'
    const { kind, provider } = getTriggerEventsProvider()
    expect(kind).toBe('none')
    const events = await provider.fetchEvents({
      userId: 'user_1',
      leadId: null,
      companyName: 'Acme',
      companyDomain: 'acme.com',
    })
    expect(events).toEqual([])
  })

  it('none returns 0 events', async () => {
    process.env.TRIGGER_EVENTS_PROVIDER = 'none'
    const { kind, provider } = getTriggerEventsProvider()
    expect(kind).toBe('none')
    const events = await provider.fetchEvents({
      userId: 'user_1',
      leadId: null,
      companyName: 'Acme',
      companyDomain: 'acme.com',
    })
    expect(events).toEqual([])
  })
})

