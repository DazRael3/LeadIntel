import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { AdminAuthBootstrapClient } from './AdminAuthBootstrapClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Auth bootstrap | LeadIntel',
  description: 'Admin-only auth bootstrap for internal test users.',
  robots: { index: false, follow: false },
}

function asString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v[0] ?? ''
  return ''
}

export default async function AdminAuthBootstrapPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = asString(sp.token) || null
  if (!isValidAdminToken(token)) notFound()

  const tokenQs = `token=${encodeURIComponent(token ?? '')}`

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Auth bootstrap</div>
          <div className="text-sm text-muted-foreground">
            Internal-only utility to create/confirm test users in Supabase Auth and set their app tier. Does not bypass login.
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/ops?${tokenQs}`}>Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/support?${tokenQs}`}>Support</Link>
          </Button>
        </div>
      </div>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Bootstrap internal test users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Admin-token gated</Badge>
            <Badge variant="outline">Creates Auth users</Badge>
            <Badge variant="outline">Sets tier in api.users</Badge>
          </div>

          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">How to use</div>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Enter email + password for the test user you want to bootstrap.</li>
              <li>Select tier (closer / closer_plus / team).</li>
              <li>Click Bootstrap. Then log in normally on `/login` with those credentials.</li>
            </ol>
            <div>
              This tool is intended to fix “wrong credentials” when the Auth user is missing or unconfirmed, and to align app tier rows with Auth.
            </div>
          </div>

          <AdminAuthBootstrapClient token={token ?? ''} />
        </CardContent>
      </Card>
    </div>
  )
}

