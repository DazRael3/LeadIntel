import { describe, expect, it } from 'vitest'
import { validatePayloadTemplate } from '@/lib/extensions/validators'

describe('extensions/validators', () => {
  it('accepts allowed vars', () => {
    const res = validatePayloadTemplate({
      account: { id: '{{account.id}}', name: '{{ account.name }}' },
      workspace: { id: '{{workspace.id}}' },
      computedAt: '{{computedAt}}',
    })
    expect(res.ok).toBe(true)
  })

  it('rejects unknown vars', () => {
    const res = validatePayloadTemplate({ bad: '{{account.secret}}' })
    expect(res.ok).toBe(false)
  })

  it('rejects non-object templates', () => {
    expect(validatePayloadTemplate('x').ok).toBe(false)
    expect(validatePayloadTemplate([]).ok).toBe(false)
    expect(validatePayloadTemplate(null).ok).toBe(false)
  })
})

