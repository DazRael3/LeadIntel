import type { PostgrestError } from '@supabase/supabase-js'

export function formatErrorMessage(err: unknown): string {
  if (err == null) return 'An unknown error occurred.'

  if (typeof err === 'string') return err

  if (err instanceof Error) {
    return err.message || 'An unexpected error occurred.'
  }

  const maybePg = err as Partial<PostgrestError>
  const parts: string[] = []

  if (typeof maybePg.message === 'string' && maybePg.message.trim()) {
    parts.push(maybePg.message.trim())
  }

  if (typeof maybePg.details === 'string' && maybePg.details.trim()) {
    parts.push(maybePg.details.trim())
  }

  if (typeof maybePg.code === 'string' && maybePg.code.trim()) {
    parts.push(`(${maybePg.code.trim()})`)
  }

  if (parts.length > 0) {
    return parts.join(' ')
  }

  try {
    return JSON.stringify(err)
  } catch {
    return 'An unexpected error occurred.'
  }
}

export function toOptionalErrorString(err: unknown): string | null {
  if (!err) return null
  return formatErrorMessage(err)
}
