import { timingSafeEqualAscii } from '@/lib/api/cron-auth'

export function isValidAdminToken(token: string | null | undefined): boolean {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  const provided = (token ?? '').trim()
  if (!expected || !provided) return false
  return timingSafeEqualAscii(provided, expected)
}

