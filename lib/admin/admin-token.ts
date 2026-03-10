export function isValidAdminToken(token: string | null | undefined): boolean {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  if (!expected) return false
  if (!token) return false
  return token === expected
}

