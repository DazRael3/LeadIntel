import { describe, expect, it } from 'vitest'
import { routeAssistantQuery } from '@/lib/assistant/router'

describe('routeAssistantQuery', () => {
  it('routes account next action', () => {
    expect(routeAssistantQuery({ scope: 'account', message: 'what is the next best action?' }).kind).toBe('next_best_action')
  })

  it('routes account handoff intents', () => {
    expect(routeAssistantQuery({ scope: 'account', message: 'prepare a crm handoff' }).kind).toBe('prepare_crm_handoff')
    expect(routeAssistantQuery({ scope: 'account', message: 'sequencer package please' }).kind).toBe('prepare_sequencer_handoff')
  })

  it('routes command center summary', () => {
    expect(routeAssistantQuery({ scope: 'command_center', message: 'what is blocked today?' }).kind).toBe('command_center_summary')
  })
})

