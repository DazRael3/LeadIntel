export function parseHouseCloserEmails(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isHouseCloserEmail(email: string | null | undefined, raw: string | undefined | null): boolean {
  if (!email) return false
  const list = parseHouseCloserEmails(raw)
  return list.includes(email.toLowerCase())
}

