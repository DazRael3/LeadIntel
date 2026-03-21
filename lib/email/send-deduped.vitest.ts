import { describe, expect, it, vi } from 'vitest'

type InsertResult = { error: { code?: string; message?: string } | null }

function fakeSupabase(args: { insert: () => Promise<InsertResult>; update?: () => any }) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({}),
  }
  const fromChain = {
    insert: vi.fn().mockImplementation(args.insert),
    update: vi.fn().mockReturnValue(updateChain),
    eq: vi.fn().mockResolvedValue({}),
  }
  return {
    from: vi.fn().mockReturnValue(fromChain),
    __chains: { fromChain, updateChain },
  } as unknown as any
}

describe('sendEmailDeduped', () => {
  it('skips when Resend is not configured', async () => {
    vi.resetModules()
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM_EMAIL', '')

    const { sendEmailDeduped } = await import('./send-deduped')
    const resendMod = await import('./resend')
    const sendSpy = vi.spyOn(resendMod, 'sendEmailWithResend')

    const supabase = fakeSupabase({
      insert: async () => ({ error: null }),
    })

    const res = await sendEmailDeduped(supabase, {
      dedupeKey: 'k1',
      userId: '00000000-0000-0000-0000-000000000001',
      toEmail: 'a@example.com',
      fromEmail: 'leadintel@dazrael.com',
      subject: 'Subj',
      html: '<b>x</b>',
      text: 'x',
      kind: 'lifecycle',
      template: 'welcome',
      tags: [],
    })

    expect(res).toEqual({ ok: true, status: 'skipped', reason: 'not_enabled' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('skips as deduped on unique violation', async () => {
    vi.resetModules()
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'leadintel@dazrael.com')

    const { sendEmailDeduped } = await import('./send-deduped')
    const resendMod = await import('./resend')
    const sendSpy = vi.spyOn(resendMod, 'sendEmailWithResend')

    const supabase = fakeSupabase({
      insert: async () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } }),
    })

    const res = await sendEmailDeduped(supabase, {
      dedupeKey: 'k2',
      userId: '00000000-0000-0000-0000-000000000002',
      toEmail: 'a@example.com',
      fromEmail: 'leadintel@dazrael.com',
      subject: 'Subj',
      html: '<b>x</b>',
      text: 'x',
      kind: 'lifecycle',
      template: 'welcome',
      tags: [],
    })

    expect(res).toEqual({ ok: true, status: 'skipped', reason: 'deduped' })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('skips safely when schema is not ready', async () => {
    vi.resetModules()
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'leadintel@dazrael.com')

    const { sendEmailDeduped } = await import('./send-deduped')
    const resendMod = await import('./resend')
    const sendSpy = vi.spyOn(resendMod, 'sendEmailWithResend')

    const supabase = fakeSupabase({
      insert: async () => ({ error: { code: '42P01', message: 'relation \"api.email_send_log\" does not exist' } }),
    })

    const res = await sendEmailDeduped(supabase, {
      dedupeKey: 'k3',
      userId: null,
      toEmail: 'a@example.com',
      fromEmail: 'leadintel@dazrael.com',
      subject: 'Subj',
      html: '<b>x</b>',
      text: 'x',
      kind: 'internal',
      template: 'admin_feedback',
      tags: [],
    })

    expect(res).toEqual({ ok: true, status: 'skipped', reason: 'schema_not_ready' })
    expect(sendSpy).not.toHaveBeenCalled()
  })
})

