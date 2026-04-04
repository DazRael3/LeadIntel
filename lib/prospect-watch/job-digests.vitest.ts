import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => {
  const makeProspectsQuery = () => ({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: 'pros_1', overall_score: 95, status: 'new' }],
            error: null,
          }),
        }),
      }),
    }),
  })

  const makeContentDraftsQuery = () => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  })

  return {
    createSupabaseAdminClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'prospect_watch_prospects') return makeProspectsQuery()
        if (table === 'prospect_watch_outreach_drafts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ count: 0, error: null })),
            })),
          }
        }
        if (table === 'prospect_watch_content_drafts') return makeContentDraftsQuery()
        throw new Error(`unexpected table: ${table}`)
      }),
    })),
  }
})

vi.mock('@/lib/email/send-deduped', () => ({
  sendEmailDeduped: vi.fn(async () => ({ ok: true, status: 'sent', messageId: 'm1' })),
}))

vi.mock('@/lib/email/internal', () => ({
  renderAdminNotificationEmail: vi.fn(() => ({ subject: 'Digest', html: '<b>Digest</b>', text: 'Digest' })),
}))

describe('runProspectWatchDigests', () => {
  it('routes digest to configured review inbox', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_DAILY_DIGEST_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_CONTENT_DIGEST_ENABLED', '0')
    vi.stubEnv('PROSPECT_WATCH_REVIEW_EMAILS', 'leadintel@dazrael.com')
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@dazrael.com')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service_role_test')

    const { runProspectWatchDigests } = await import('./job')
    const { sendEmailDeduped } = await import('@/lib/email/send-deduped')

    const res = await runProspectWatchDigests({})
    expect(res.status).toBe('ok')
    expect(res.summary).toMatchObject({
      recipients: 1,
      attempted: 1,
      delivered: 1,
      failed: 0,
      skipped: 0,
    })
    expect(sendEmailDeduped).toHaveBeenCalledTimes(1)
    expect((sendEmailDeduped as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[1]).toMatchObject({
      toEmail: 'leadintel@dazrael.com',
      template: 'prospect_watch_daily_digest',
      kind: 'internal',
    })
  })
})

