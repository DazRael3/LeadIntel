import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Reports Redirect | LeadIntel',
  description: 'Legacy reports route redirecting to the competitive reports hub.',
  alternates: { canonical: 'https://raelinfo.com/competitive-report' },
  robots: { index: false, follow: true },
}

export const dynamic = 'force-dynamic'

export default async function ReportsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const qs = new URLSearchParams()
  qs.set('source', 'reports')
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
  }
  const suffix = qs.toString()
  permanentRedirect(suffix ? `/competitive-report?${suffix}` : '/competitive-report')
}

