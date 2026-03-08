import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefinementBoard } from '@/components/refinement/RefinementBoard'
import { auditRefinement } from '@/lib/refinement/audit'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Refinement | LeadIntel',
  description: 'Admin refinement audit board for platform polish and consistency.',
  robots: { index: false, follow: false },
}

function requireAdminToken(token: string | null): void {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  if (!expected) notFound()
  if (!token || token !== expected) notFound()
}

export default async function AdminRefinementPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const token = typeof sp.token === 'string' ? sp.token : null
  requireAdminToken(token)

  const report = auditRefinement()

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <PageViewTrack event="refinement_board_viewed" props={{ surface: 'admin_refinement' }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-foreground">Refinement</div>
          <div className="text-sm text-muted-foreground">Structured audit of polish gaps and platform consistency.</div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/ops?token=${encodeURIComponent(token ?? '')}`}>Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/growth?token=${encodeURIComponent(token ?? '')}`}>Growth Ops</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/status">Status</Link>
          </Button>
        </div>
      </div>

      <RefinementBoard report={report} />
    </div>
  )
}

