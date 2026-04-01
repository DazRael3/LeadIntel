import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { isAdminRequestAuthorized } from '@/lib/admin/access'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { ensurePersonalWorkspace } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

const TierSchema = z.enum(['starter', 'closer', 'closer_plus', 'team'])

const BodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  tier: TierSchema,
  confirmEmail: z.boolean().optional().default(true),
  resetPassword: z.boolean().optional().default(false),
  mode: z.enum(['upsert', 'create_only']).optional().default('upsert'),
})

type AdminAuthApi = {
  auth: {
    admin: {
      listUsers: (args?: { page?: number; perPage?: number }) => Promise<{ data: { users: unknown[] } | null; error: { message?: string } | null }>
      createUser: (args: {
        email: string
        password: string
        email_confirm: boolean
        user_metadata?: Record<string, unknown>
      }) => Promise<{ data: { user?: { id?: string | null; email?: string | null } | null } | null; error: { message?: string } | null }>
      updateUserById: (id: string, args: { password?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) => Promise<{ data: unknown; error: { message?: string } | null }>
    }
  }
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  if (!needle) return null
  try {
    const api = admin as unknown as AdminAuthApi
    // Best-effort: listUsers pagination varies by Supabase versions; try first page only.
    const { data, error } = await api.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) return null
    const users = (data?.users ?? []) as unknown[]
    for (const u of users) {
      if (!u || typeof u !== 'object') continue
      const row = u as Record<string, unknown>
      const id = typeof row.id === 'string' ? row.id : null
      const e = typeof row.email === 'string' ? row.email.toLowerCase() : null
      if (id && e === needle) return id
    }
    return null
  } catch {
    return null
  }
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const authed = isAdminRequestAuthorized({ request })
      if (!authed) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const email = parsed.data.email.trim().toLowerCase()
      const password = parsed.data.password
      const tier = parsed.data.tier
      const confirmEmail = Boolean(parsed.data.confirmEmail)
      const resetPassword = Boolean(parsed.data.resetPassword)
      const mode = parsed.data.mode

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const api = admin as unknown as AdminAuthApi

      // 1) Ensure Auth user exists (and optionally reset password / confirm email).
      let userId = await findAuthUserIdByEmail(admin, email)
      if (mode === 'create_only' && userId) {
        return fail(
          ErrorCode.CONFLICT,
          'User already exists',
          { email },
          { status: 409 },
          bridge,
          requestId
        )
      }
      if (!userId) {
        const { data, error } = await api.auth.admin.createUser({
          email,
          password,
          email_confirm: confirmEmail,
          user_metadata: { internal_seed: true, intended_tier: tier },
        })
        if (error || !data?.user?.id) {
          return fail(
            ErrorCode.DATABASE_ERROR,
            'Failed to create auth user',
            { message: error?.message ?? 'unknown' },
            { status: 500 },
            bridge,
            requestId
          )
        }
        userId = String(data.user.id)
      } else if (resetPassword || confirmEmail) {
        await api.auth.admin.updateUserById(userId, {
          ...(resetPassword ? { password } : {}),
          ...(confirmEmail ? { email_confirm: true } : {}),
          user_metadata: { internal_seed: true, intended_tier: tier },
        })
      }

      if (!userId) {
        return fail(ErrorCode.DATABASE_ERROR, 'Auth user unavailable', undefined, { status: 500 }, bridge, requestId)
      }

      // 2) Ensure api.users row exists and tier is set (best-effort).
      const subscriptionTier =
        tier === 'starter'
          ? 'free'
          : tier === 'team'
            ? 'team'
            : tier === 'closer_plus'
              ? 'closer_plus'
              : 'pro'
      try {
        await admin.schema('api').from('users').upsert(
          { id: userId, email, subscription_tier: subscriptionTier } as never,
          {
            onConflict: 'id',
          }
        )
      } catch {
        // Best-effort only. Auth bootstrap should remain usable even if the app schema is misconfigured.
      }

      // 3) Ensure the user has a workspace + membership (RLS bypass via service role).
      // We intentionally create a personal workspace to make logged-in UX stable.
      let workspaceId: string | null = null
      try {
        const ws = await ensurePersonalWorkspace({ supabase: admin as any, userId, name: tier === 'team' ? 'Team Workspace' : 'Workspace' })
        workspaceId = ws.id
      } catch {
        workspaceId = null
      }

      return ok(
        {
          userId,
          email,
          tier,
          workspaceId,
          notes: [
            confirmEmail ? 'email_confirmed' : 'email_not_confirmed',
            resetPassword ? 'password_reset' : 'password_unchanged',
          ],
        },
        undefined,
        bridge,
        requestId
      )
    } catch (err) {
      return asHttpError(err, '/api/admin/auth/bootstrap', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

