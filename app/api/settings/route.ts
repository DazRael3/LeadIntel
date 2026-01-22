import { NextRequest } from 'next/server'
import { getDbClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { UserSettingsSchema } from '@/lib/api/schemas'
import { validateOrigin } from '@/lib/api/security'

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  const route = '/api/settings'
  
  try {
    // Validate origin for state-changing requests
    const originError = validateOrigin(request, route)
    if (originError) {
      return originError
    }
    
    // Validate request body
    let body
    try {
      body = await validateBody(request, UserSettingsSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = getDbClient(request, bridge)

    // Authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const display_name = body.display_name
    const from_email = body.from_email
    const from_name = body.from_name || display_name || null
    const digest_enabled = body.digest_enabled ?? false
    const digest_dow = body.digest_dow ?? 1
    const digest_hour = body.digest_hour ?? 9
    const digest_webhook_url = body.digest_webhook_url || null
    const autopilot_enabled = typeof body.autopilot_enabled === 'boolean' ? body.autopilot_enabled : undefined

    const { error, data: updated } = await supabase
      .from('user_settings')
      .upsert({
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
      }, {
        onConflict: 'user_id',
      })
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
          bridge
        )
      }
      
      return fail(
        ErrorCode.DATABASE_ERROR,
        'Failed to save settings',
        undefined,
        undefined,
        bridge
      )
    }

    return ok({ settings: updated }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/settings', undefined, bridge)
  }
}
