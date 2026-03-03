/**
 * /api/settings
 * - 200: settings saved successfully
 * - 400: invalid payload (Zod validation failed)
 * - 401: not authenticated
 * - 403: forbidden by RLS
 * - 424: schema/migration issue (see logs)
 * - 500: unexpected internal error
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { UserSettingsSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { IS_DEV, logError, logInfo, logWarn } from '@/lib/observability/logger'

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
    // Correlation ID: reuse requestId when present to avoid inventing a second ID.
    const base = (requestId ?? '').trim() || new Date().toISOString()
    let correlationId = `settings:${base}:anon`
    try {
      const supabase = createRouteClient(request, bridge)

      // Authenticated user (guard should have enforced, but we still fetch for cookie bridging).
      // Use safe-auth so refresh_token_not_found becomes a clean "logged out" state.
      const user = await getUserSafe(supabase)
      if (!user) {
        logInfo({
          scope: 'settings',
          message: 'save.unauthenticated',
          correlationId,
        })
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401, headers: { 'x-correlation-id': correlationId } }
        )
      }
      correlationId = `settings:${base}:${user.id}`

      const parsed = UserSettingsSchema.safeParse(body)
      if (!parsed.success) {
        logWarn({
          scope: 'settings',
          message: 'save.invalid-payload',
          correlationId,
          userId: user.id,
          issues: IS_DEV ? parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) : undefined,
        })
        return NextResponse.json(
          {
            error: 'Invalid settings payload',
            details: IS_DEV ? parsed.error.issues : undefined,
          },
          { status: 400, headers: { 'x-correlation-id': correlationId } }
        )
      }
      const input = parsed.data
      const display_name = typeof input.display_name === 'string' ? input.display_name : undefined
      const from_email = typeof input.from_email === 'string' ? input.from_email : undefined
      const from_name = typeof input.from_name === 'string' ? input.from_name : display_name || null
      const what_you_sell = typeof input.what_you_sell === 'string' ? input.what_you_sell : undefined
      const ideal_customer = typeof input.ideal_customer === 'string' ? input.ideal_customer : undefined
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
      const phone =
        input.phone === undefined
          ? undefined
          : (typeof input.phone === 'string' ? input.phone.trim() : '').trim() || null
      const onboarding_completed =
        typeof input.onboarding_completed === 'boolean' ? input.onboarding_completed : true
      const tour_completed_at = typeof input.tour_completed_at === 'string' ? input.tour_completed_at : undefined

      const { error, data: updated } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            ...(display_name !== undefined ? { display_name } : {}),
            ...(from_email !== undefined ? { from_email } : {}),
            from_name: from_name || null,
            ...(what_you_sell !== undefined ? { what_you_sell } : {}),
            ...(ideal_customer !== undefined ? { ideal_customer } : {}),
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
            ...(phone !== undefined ? { phone } : {}),
            ...(tour_completed_at !== undefined ? { tour_completed_at } : {}),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select(
          'user_id, onboarding_completed, role, team_size, primary_goal, heard_about_us_from, preferred_contact_channel, preferred_contact_detail, allow_product_updates, phone, what_you_sell, ideal_customer, digest_enabled, digest_dow, digest_hour, digest_webhook_url, tour_completed_at, updated_at'
        )
        .single()

      if (error) {
        // Detect PostgREST schema cache errors or missing column errors
        const isSchemaCacheError =
          error.message?.includes('schema cache') ||
          error.message?.includes('Could not find') ||
          error.message?.includes('digest_dow') ||
          error.message?.includes('digest_enabled') ||
          error.message?.includes('digest_hour') ||
          error.message?.includes('tour_completed_at') ||
          error.code === 'PGRST204' ||
          error.code === '42P01' || // PostgreSQL: undefined_table
          error.hint?.includes('schema cache')

        if (isSchemaCacheError) {
          logError({
            scope: 'settings',
            message: 'save.schema-error',
            correlationId,
            userId: user.id,
            supabaseCode: (error as SupabaseWriteError).code,
          })
          const res = fail(
            ErrorCode.SCHEMA_MIGRATION_REQUIRED,
            'Database schema migration required. Please apply the latest Supabase migrations and reload schema cache.',
            {
              action: 'Apply migrations and reload schema cache',
              migration_file: 'supabase/migrations/',
              sqlHint: "After running the migration, execute: NOTIFY pgrst, 'reload schema';",
            },
            { status: 424, headers: { 'x-correlation-id': correlationId } },
            bridge,
            requestId
          )
          return res
        }

        if (isRlsOrPermissionError(error as SupabaseWriteError)) {
          logWarn({
            scope: 'settings',
            message: 'save.forbidden',
            correlationId,
            userId: user.id,
            supabaseCode: (error as SupabaseWriteError).code,
          })
          return NextResponse.json(
            {
              error: 'Forbidden',
              details: IS_DEV ? { code: (error as SupabaseWriteError).code } : undefined,
            },
            { status: 403, headers: { 'x-correlation-id': correlationId } }
          )
        }

        // Default: treat as server-side save failure but with a clear payload.
        logError({
          scope: 'settings',
          message: 'save.unhandled-error',
          correlationId,
          userId: user.id,
          supabaseCode: (error as SupabaseWriteError).code,
        })
        return NextResponse.json(
          {
            error: 'Failed to save settings',
            details: IS_DEV ? { code: (error as SupabaseWriteError).code } : undefined,
          },
          { status: 500, headers: { 'x-correlation-id': correlationId } }
        )
      }

      logInfo({
        scope: 'settings',
        message: 'save.success',
        userId: user.id,
        correlationId,
      })
      return ok({ settings: updated }, { headers: { 'x-correlation-id': correlationId } }, bridge, requestId)
    } catch (error: unknown) {
      logError({
        scope: 'settings',
        message: 'save.unhandled-error',
        correlationId,
        error: IS_DEV ? String(error) : undefined,
      })

      return NextResponse.json(
        {
          error: 'Failed to save settings',
          details: IS_DEV ? { error: String(error) } : undefined,
        },
        { status: 500, headers: { 'x-correlation-id': correlationId } }
      )
    }
  },
  // We validate inside the handler so we can return a dev-friendly 400 payload.
)
