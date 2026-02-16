import type { SupabaseClient, User } from '@supabase/supabase-js'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isRefreshTokenNotFound(error: unknown): boolean {
  if (!isObject(error)) return false
  const code = typeof error.code === 'string' ? error.code : ''
  const message = typeof error.message === 'string' ? error.message : ''
  return code === 'refresh_token_not_found' || message.toLowerCase().includes('refresh token not found')
}

/**
 * Best-effort user fetch that treats refresh_token_not_found as "logged out" and self-heals by signing out.
 * This prevents dev-console spam and retry loops after storage/cookies drift.
 */
export async function getUserSafe(supabase: SupabaseClient): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      if (isRefreshTokenNotFound(error)) {
        try {
          await supabase.auth.signOut()
        } catch {
          // ignore
        }
        return null
      }
      return null
    }
    return data.user ?? null
  } catch (err) {
    if (isRefreshTokenNotFound(err)) {
      try {
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
      return null
    }
    return null
  }
}

