import { describe, expect, it } from 'vitest'
import { renderPayloadTemplate } from '@/lib/extensions/runtime'
import type { CustomActionRunContext } from '@/lib/extensions/types'

describe('extensions/runtime', () => {
  it('renders string templates', () => {
    const ctx: CustomActionRunContext = {
      workspaceId: 'w1',
      account: { id: 'a1', lead_id: null, name: 'Acme', domain: 'acme.com', program_state: 'standard' },
      computedAt: '2026-01-01T00:00:00.000Z',
    }
    const out = renderPayloadTemplate({
      ctx,
      template: { id: '{{account.id}}', nested: { ws: '{{workspace.id}}', t: '{{computedAt}}' }, label: 'Hello {{account.name}}' },
    })
    expect(out).toEqual({ id: 'a1', nested: { ws: 'w1', t: '2026-01-01T00:00:00.000Z' }, label: 'Hello Acme' })
  })
})

