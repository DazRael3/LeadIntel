import { describe, expect, it, vi } from 'vitest'

const notFoundMock = vi.fn()

vi.mock('next/navigation', () => ({
  notFound: () => {
    notFoundMock()
    throw new Error('NEXT_NOT_FOUND')
  },
}))

vi.mock('@/lib/admin/admin-token', () => ({
  isValidAdminToken: (token: string | null | undefined) => token === 'ok',
}))

vi.mock('@/lib/ops/opsHealth', () => ({
  computeOpsHealth: vi.fn(async () => {
    throw new Error('health_unavailable')
  }),
}))

vi.mock('@/lib/ops/envDoctor', () => ({
  runEnvDoctor: vi.fn(() => {
    throw new Error('env_doctor_boom')
  }),
}))

vi.mock('@/lib/jobs/persist', () => ({
  readLatestJobRuns: vi.fn(async () => ({ enabled: false, runs: [] })),
}))

vi.mock('@/lib/lifecycle/config', () => ({
  lifecycleEmailsEnabled: () => false,
  adminNotificationsEnabled: () => false,
  getLifecycleAdminEmails: () => [],
}))

vi.mock('@/lib/prospect-watch/config', () => ({
  prospectWatchEnabled: () => false,
  prospectDailyDigestEnabled: () => false,
  contentDailyDigestEnabled: () => false,
  getReviewEmails: () => [],
}))

vi.mock('@/lib/app-url', () => ({
  getAppUrl: () => 'https://example.com',
}))

vi.mock('@/lib/email/qa', () => ({
  qaAllEmailTemplates: () => [],
}))

vi.mock('@/lib/prospect-watch/job', () => ({
  runProspectWatch: vi.fn(async () => {
    throw new Error('prospect_diag_boom')
  }),
}))

vi.mock('@/lib/ops/learningAgent', () => ({
  generateLearningAgentReport: vi.fn(async () => {
    throw new Error('learning_boom')
  }),
}))

// Client component used by the page; stub to avoid JSDOM complexity.
vi.mock('./AdminKpiMonitorPanelClient', () => ({
  AdminKpiMonitorPanelClient: () => null,
}))

describe('/admin/ops page (server)', () => {
  it('does not crash when optional subsystems throw (fail-soft by section)', async () => {
    const mod = await import('./page')
    await expect(mod.default({ searchParams: Promise.resolve({ token: 'ok' }) })).resolves.toBeTruthy()
  })

  it('returns notFound when token is invalid', async () => {
    const mod = await import('./page')
    await expect(mod.default({ searchParams: Promise.resolve({ token: 'nope' }) })).rejects.toThrow(/NEXT_NOT_FOUND/)
    expect(notFoundMock).toHaveBeenCalledTimes(1)
  })
})

