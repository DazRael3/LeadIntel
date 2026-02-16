import { describe, expect, it } from 'vitest'
import crypto from 'crypto'
import { verifyResendWebhookSignature } from './resend-webhook'

describe('verifyResendWebhookSignature', () => {
  it('accepts valid svix signature', () => {
    const secret = 'whsec_test_secret'
    const payload = Buffer.from(JSON.stringify({ type: 'email.delivered', data: { id: 'email_123' } }))
    const svixId = 'msg_1'
    const svixTimestamp = '1700000000'
    const toSign = `${svixId}.${svixTimestamp}.${payload.toString('utf-8')}`
    const sig = crypto.createHmac('sha256', secret).update(toSign).digest('base64')

    const ok = verifyResendWebhookSignature({
      secret,
      rawBody: payload,
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${sig}`,
      },
      nowMs: Number(svixTimestamp) * 1000,
      toleranceSeconds: 300,
    })
    expect(ok).toBe(true)
  })

  it('rejects invalid svix signature', () => {
    const secret = 'whsec_test_secret'
    const payload = Buffer.from(JSON.stringify({ type: 'email.delivered', data: { id: 'email_123' } }))
    const svixId = 'msg_1'
    const svixTimestamp = '1700000000'

    const ok = verifyResendWebhookSignature({
      secret,
      rawBody: payload,
      headers: {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${Buffer.from('wrong').toString('base64')}`,
      },
      nowMs: Number(svixTimestamp) * 1000,
      toleranceSeconds: 300,
    })
    expect(ok).toBe(false)
  })

  it('accepts legacy x-resend-signature hex digest', () => {
    const secret = 'test_legacy_secret'
    const payload = Buffer.from('{"hello":"world"}')
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    const ok = verifyResendWebhookSignature({
      secret,
      rawBody: payload,
      headers: {
        'x-resend-signature': sig,
      },
    })
    expect(ok).toBe(true)
  })
})

