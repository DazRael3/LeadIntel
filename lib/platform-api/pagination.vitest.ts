import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor } from '@/lib/platform-api/pagination'

describe('platform-api/pagination', () => {
  it('encodes/decodes cursor roundtrip', () => {
    const cur = { t: new Date().toISOString(), id: '00000000-0000-0000-0000-000000000000' }
    const enc = encodeCursor(cur)
    expect(enc).toBeTypeOf('string')
    const dec = decodeCursor(enc)
    expect(dec).toEqual(cur)
  })

  it('returns null for invalid cursor', () => {
    expect(decodeCursor('not-base64')).toBeNull()
    expect(decodeCursor(null)).toBeNull()
  })
})

