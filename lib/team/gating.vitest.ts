import { describe, expect, it, vi } from 'vitest'

describe('team gating', () => {
  async function withEnv<K extends string>(key: K, value: string | undefined, fn: () => Promise<void> | void): Promise<void> {
    const prev = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
    try {
      await fn()
    } finally {
      if (prev === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = prev
      }
    }
  }

  async function withNoE2EEnv(fn: () => Promise<void>) {
    await withEnv('E2E', undefined, async () =>
      withEnv('PLAYWRIGHT', undefined, async () =>
        withEnv('NEXT_PUBLIC_E2E', undefined, async () => withEnv('NEXT_PUBLIC_PLAYWRIGHT', undefined, fn))
      )
    )
  }

  it('fails soft to starter when no supabase is provided and service role missing', async () => {
    await withNoE2EEnv(async () => {
      vi.resetModules()
      const resolveTierFromDb = vi.fn(async () => ({ tier: 'team' }))
      vi.doMock('@/lib/billing/resolve-tier', () => ({
        resolveTierFromDb,
      }))

      const createSupabaseAdminClient = vi.fn(() => {
        throw new Error('should_not_create_admin_client_when_service_role_missing')
      })
      vi.doMock('@/lib/supabase/admin', () => ({
        createSupabaseAdminClient,
      }))

      vi.doMock('@/lib/config/runtimeEnv', () => ({
        hasSupabaseServiceRoleConfigured: () => false,
      }))

      const { getUserTierForGating } = await import('./gating')
      const tier = await getUserTierForGating({ userId: 'user_1', sessionEmail: 'u1@example.com' })
      expect(tier).toBe('starter')
      expect(resolveTierFromDb).toHaveBeenCalledTimes(0)
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(0)
    })
  })

  it('prefers request-scoped supabase when provided (does not require service role)', async () => {
    await withNoE2EEnv(async () => {
      vi.resetModules()
      const resolveTierFromDb = vi.fn(async () => ({ tier: 'team' }))
      vi.doMock('@/lib/billing/resolve-tier', () => ({
        resolveTierFromDb,
      }))

      const createSupabaseAdminClient = vi.fn(() => {
        throw new Error('should_not_create_admin_client_when_supabase_provided')
      })
      vi.doMock('@/lib/supabase/admin', () => ({
        createSupabaseAdminClient,
      }))

      vi.doMock('@/lib/config/runtimeEnv', () => ({
        hasSupabaseServiceRoleConfigured: () => false,
      }))

      const { requireTeamPlan } = await import('./gating')
      const schema = vi.fn(() => ({} as unknown as import('@supabase/supabase-js').SupabaseClient))
      const supabase = { schema } as unknown as import('@supabase/supabase-js').SupabaseClient
      const gate = await requireTeamPlan({ userId: 'user_1', sessionEmail: 'u1@example.com', supabase })
      expect(gate.ok).toBe(true)
      expect(resolveTierFromDb).toHaveBeenCalledTimes(1)
      expect(schema).toHaveBeenCalledWith('api')
      expect(createSupabaseAdminClient).toHaveBeenCalledTimes(0)
    })
  })
})

