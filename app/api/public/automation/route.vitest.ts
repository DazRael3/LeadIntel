import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type JobRunRow = { status: string; finished_at: string }

const jobRunByName = new Map<string, JobRunRow>()
let webhookEndpointCount = 0

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: (request: NextRequest, ctx: { requestId: string }) => Promise<Response> | Response) => {
    return (request: NextRequest) => handler(request, { requestId: 'req_automation' })
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'webhook_endpoints') {
        return {
          select: () => ({
            eq: async () => ({ count: webhookEndpointCount }),
          }),
        }
      }

      if (table === 'job_runs') {
        return {
          select: () => ({
            eq: (_column: string, jobName: string) => ({
              not: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: jobRunByName.get(jobName) ?? null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  })),
}))

describe('/api/public/automation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    jobRunByName.clear()
    webhookEndpointCount = 0

    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.CRON_SECRET
    delete process.env.EXTERNAL_CRON_SECRET
    delete process.env.LIFECYCLE_EMAILS_ENABLED
    delete process.env.PROSPECT_WATCH_ENABLED
    delete process.env.PROSPECT_WATCH_DAILY_DIGEST_ENABLED
    delete process.env.PROSPECT_WATCH_CONTENT_DIGEST_ENABLED
  })

  it('reports external_required when scheduler dependencies are unavailable', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/automation'))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.enabled).toBe(false)
    expect(json.data.healthStatus).toBe('external_required')
    expect(json.data.scheduler.missingExternalJobs).toBeGreaterThan(0)
    expect(json.data.scheduler.jobs.some((job: { state?: string }) => job.state === 'external')).toBe(true)
  })

  it('reports healthy when required jobs are recent and successful', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    const nowIso = new Date().toISOString()
    jobRunByName.set('lifecycle', { status: 'ok', finished_at: nowIso })
    jobRunByName.set('digest_lite', { status: 'ok', finished_at: nowIso })
    jobRunByName.set('kpi_monitor', { status: 'ok', finished_at: nowIso })
    jobRunByName.set('content_audit', { status: 'ok', finished_at: nowIso })
    jobRunByName.set('growth_cycle', { status: 'ok', finished_at: nowIso })
    jobRunByName.set('sources_refresh', { status: 'ok', finished_at: nowIso })

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/public/automation'))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.enabled).toBe(true)
    expect(json.data.healthStatus).toBe('healthy')
    expect(json.data.summary.failedJobs).toBe(0)
    expect(json.data.summary.staleJobs).toBe(0)
    expect(json.data.summary.missingJobs).toBe(0)
    expect(json.data.scheduler.missingRequiredJobs).toBe(0)
  })
})
