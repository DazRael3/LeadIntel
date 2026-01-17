import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { serverEnv, clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode } from '@/lib/api/http'
import { CreateUserSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'

/**
 * DEV-ONLY endpoint to create users without email verification
 * 
 * This endpoint is only available in development mode and requires
 * a secret header to prevent accidental exposure in production.
 */

export const POST = withApiGuard(
  async (request, { body, requestId }) => {
    // Additional dev secret check (guard already blocks in production)
    const devSecret = request.headers.get('x-dev-secret')
    if (devSecret !== serverEnv.DEV_SEED_SECRET) {
      return fail(
        ErrorCode.FORBIDDEN,
        'Invalid dev secret',
        undefined,
        undefined,
        undefined,
        requestId
      )
    }

    const data = body as { email: string; password: string }
    const { email, password } = data

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Create user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email in dev
    })

    if (authError || !authData.user) {
      return fail(
        ErrorCode.DATABASE_ERROR,
        'Failed to create user',
        { details: authError?.message },
        undefined,
        undefined,
        requestId
      )
    }

    // Create user record
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email || email,
        subscription_tier: 'free',
        credits_remaining: 1,
      })

    if (userError) {
      console.error('Error creating user record:', userError)
      // Continue anyway - user was created in auth
    }

    return ok(
      { 
        user: {
          id: authData.user.id,
          email: authData.user.email,
        }
      },
      undefined,
      undefined,
      requestId
    )
  },
  {
    bodySchema: CreateUserSchema,
  }
)
