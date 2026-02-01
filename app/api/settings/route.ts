import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { UserSettingsSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { createCorrelationId, logError, logWarn } from '@/lib/logging'

type SupabaseWriteError = { code?: string; message?: string; details?: string | null; hint?: string | null }

function isRlsOrPermissionError(err: SupabaseWriteError): boolean {
  const msg = (err.message ?? '').toLowerCase()
  const code = (err.code ?? '').toLowerCase()
  return (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('insufficient privilege')
  )
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    let correlationId = createCorrelationId('settings', requestId)
    try {
      const supabase = createRouteClient(request, bridge)

      // Authenticated user (guard should have enforced, but we still fetch for cookie bridging).
      // Use safe-auth so refresh_token_not_found becomes a clean "logged out" state.
      const user = await getUserSafe(supabase)
      if (!user) {
        const res = NextResponse.json(
          { error: 'Not authenticated', code: 'not_authenticated', correlationId },
          { status: 401 }
        )
        res.headers.set('x-correlation-id', correlationId)
        return res
      }
      correlationId = createCorrelationId('settings', requestId, user.id)

      const parsed = UserSettingsSchema.safeParse(body)
      if (!parsed.success) {
        logWarn({
          scope: 'settings',
          message: 'save.invalid_payload',
          statusCode: 400,
          correlationId,
          userId: user.id,
          errorCode: 'invalid_payload',
          details:
            process.env.NODE_ENV === 'development'
              ? parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
              : undefined,
        })
        const res = NextResponse.json(
          {
            error: 'Invalid settings payload',
            code: 'invalid_payload',
            correlationId,
            details:
              process.env.NODE_ENV === 'development'
                ? parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
                : undefined,
          },
          { status: 400 }
        )
        res.headers.set('x-correlation-id', correlationId)
        return res
      }
      const input = parsed.data
      const display_name = typeof input.display_name === 'string' ? input.display_name : undefined
      const from_email = typeof input.from_email === 'string' ? input.from_email : undefined
      const from_name = typeof input.from_name === 'string' ? input.from_name : display_name || null
      const digest_enabled = input.digest_enabled ?? false
      const digest_dow = input.digest_dow ?? 1
      const digest_hour = input.digest_hour ?? 9
      const digest_webhook_url = input.digest_webhook_url || null
      const autopilot_enabled = typeof input.autopilot_enabled === 'boolean' ? input.autopilot_enabled : undefined
      const role = typeof input.role === 'string' ? input.role : undefined
      const team_size = typeof input.team_size === 'string' ? input.team_size : undefined
      const primary_goal = typeof input.primary_goal === 'string' ? input.primary_goal : undefined
      const heard_about_us_from = typeof input.heard_about_us_from === 'string' ? input.heard_about_us_from : undefined
      const preferred_contact_channel = typeof input.preferred_contact_channel === 'string' ? input.preferred_contact_channel : undefined
      const preferred_contact_detail = typeof input.preferred_contact_detail === 'string' ? input.preferred_contact_detail : undefined
      const allow_product_updates = typeof input.allow_product_updates === 'boolean' ? input.allow_product_updates : undefined
      const onboarding_completed =
        typeof input.onboarding_completed === 'boolean' ? input.onboarding_completed : true

      const { error, data: updated } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            ...(display_name !== undefined ? { display_name } : {}),
            ...(from_email !== undefined ? { from_email } : {}),
            from_name: from_name || null,
            onboarding_completed,
            digest_enabled,
            digest_dow,
            digest_hour,
            digest_webhook_url: digest_webhook_url || null,
            ...(role !== undefined ? { role } : {}),
            ...(team_size !== undefined ? { team_size } : {}),
            ...(primary_goal !== undefined ? { primary_goal } : {}),
            ...(heard_about_us_from !== undefined ? { heard_about_us_from } : {}),
            ...(preferred_contact_channel !== undefined ? { preferred_contact_channel } : {}),
            ...(preferred_contact_detail !== undefined ? { preferred_contact_detail } : {}),
            ...(allow_product_updates !== undefined ? { allow_product_updates } : {}),
            ...(autopilot_enabled !== undefined ? { autopilot_enabled } : {}),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select('user_id, onboarding_completed, role, team_size, primary_goal, heard_about_us_from, preferred_contact_channel, preferred_contact_detail, allow_product_updates, digest_enabled, digest_dow, digest_hour, digest_webhook_url, updated_at')
        .single()

      if (error) {
        logError({
          scope: 'settings',
          message: 'save.supabase_upsert_failed',
          statusCode: 500,
          correlationId,
          userId: user.id,
          errorCode: (error as SupabaseWriteError).code ?? 'supabase_upsert_failed',
          details:
            process.env.NODE_ENV === 'development'
              ? { code: (error as SupabaseWriteError).code, message: (error as SupabaseWriteError).message }
              : undefined,
        })

        // Detect PostgREST schema cache errors or missing column errors
        const isSchemaCacheError =
          error.message?.includes('schema cache') ||
          error.message?.includes('Could not find') ||
          error.message?.includes('digest_dow') ||
          error.message?.includes('digest_enabled') ||
          error.message?.includes('digest_hour') ||
          error.code === 'PGRST204' ||
          error.code === '42P01' || // PostgreSQL: undefined_table
          error.hint?.includes('schema cache')

        if (isSchemaCacheError) {
          const res = NextResponse.json(
            {
              error: 'Database schema migration required. Please apply the latest Supabase migrations and reload schema cache.',
              code: ErrorCode.SCHEMA_MIGRATION_REQUIRED,
              correlationId,
            },
            { status: 424 }
          )
          res.headers.set('x-correlation-id', correlationId)
          return res
        }

        if (isRlsOrPermissionError(error as SupabaseWriteError)) {
          const res = NextResponse.json(
            {
              error: 'Forbidden',
              code: 'forbidden',
              correlationId,
              details:
                process.env.NODE_ENV === 'development'
                  ? `${(error as SupabaseWriteError).code ?? ''} ${(error as SupabaseWriteError).message ?? ''}`.trim()
                  : undefined,
            },
            { status: 403 }
          )
          res.headers.set('x-correlation-id', correlationId)
          return res
        }

        // Default: treat as server-side save failure but with a clear payload.
        const res = NextResponse.json(
          {
            error: 'Failed to save settings',
            code: 'settings_save_failed',
            correlationId,
            details:
              process.env.NODE_ENV === 'development'
                ? `${(error as SupabaseWriteError).code ?? ''} ${(error as SupabaseWriteError).message ?? ''}`.trim()
                : undefined,
          },
          { status: 500 }
        )
        res.headers.set('x-correlation-id', correlationId)
        return res
      }

      return ok({ settings: updated }, undefined, bridge, requestId)
    } catch (error: unknown) {
      logError({
        scope: 'settings',
        message: 'save.failed',
        statusCode: 500,
        correlationId,
        errorCode: 'unexpected_error',
        details: process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined,
      })

      const res = NextResponse.json(
        {
          error: 'Failed to save settings',
          code: 'settings_save_failed',
          correlationId,
          details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        },
        { status: 500 }
      )
      res.headers.set('x-correlation-id', correlationId)
      return res
    }
  },
  // We validate inside the handler so we can return a dev-friendly 400 payload.
)
