import { NextRequest, NextResponse } from 'next/server'

function expectedBearer(secret: string | undefined): string | null {
  const s = (secret ?? '').trim()
  if (!s) return null
  return `Bearer ${s}`
}

export function requireCronAuth(req: NextRequest): void | NextResponse {
  const auth = (req.headers.get('authorization') ?? '').trim()
  const expectedVercel = expectedBearer(process.env.CRON_SECRET)
  const expectedExternal = expectedBearer(process.env.EXTERNAL_CRON_SECRET)

  const ok =
    (expectedVercel !== null && auth === expectedVercel) ||
    (expectedExternal !== null && auth === expectedExternal)

  if (ok) return

  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
}

