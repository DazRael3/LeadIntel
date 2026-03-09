import { z } from 'zod'

export const CursorSchema = z.string().trim().min(1).max(400).optional().nullable()

export type Cursor = { t: string; id: string }

export function encodeCursor(cursor: Cursor | null): string | null {
  if (!cursor) return null
  const raw = JSON.stringify(cursor)
  return Buffer.from(raw, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): Cursor | null {
  if (!cursor) return null
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const obj = JSON.parse(raw) as { t?: unknown; id?: unknown }
    if (typeof obj.t !== 'string' || typeof obj.id !== 'string') return null
    return { t: obj.t, id: obj.id }
  } catch {
    return null
  }
}

