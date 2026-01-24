import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { UserSettingsSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)

      // Authenticated user (guard should have enforced, but we still fetch for cookie bridging)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const input = body as typeof UserSettingsSchema._type
      const display_name = input.display_name
      const from_email = input.from_email
      const from_name = input.from_name || display_name || null
      const digest_enabled = input.digest_enabled ?? false
      const digest_dow = input.digest_dow ?? 1
      const digest_hour = input.digest_hour ?? 9
      const digest_webhook_url = input.digest_webhook_url || null
      const autopilot_enabled = typeof input.autopilot_enabled === 'boolean' ? input.autopilot_enabled : undefined

      const { error, data: updated } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            display_name,
            from_email,
            from_name: from_name || null,
            onboarding_completed: true,
            digest_enabled,
            digest_dow,
            digest_hour,
            digest_webhook_url: digest_webhook_url || null,
            ...(autopilot_enabled !== undefined ? { autopilot_enabled } : {}),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select('user_id, onboarding_completed, digest_enabled, digest_dow, digest_hour, digest_webhook_url, updated_at')
        .single()

      if (error) {
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
          return fail(
            ErrorCode.SCHEMA_MIGRATION_REQUIRED,
            'Database schema migration required. The digest settings columns are missing from the user_settings table.',
            {
              action: 'Run migration 0004_digest_settings.sql and reload schema cache',
              migration_file: 'supabase/migrations/0004_digest_settings.sql',
              sqlHint: "After running the migration, execute: NOTIFY pgrst, 'reload schema';",
            },
            undefined,
            bridge,
            requestId
          )
        }

        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save settings', undefined, undefined, bridge, requestId)
      }

      return ok({ settings: updated }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/settings', undefined, bridge, requestId)
    }
  },
  { bodySchema: UserSettingsSchema }
)
