import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ReportsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await props.searchParams) ?? {}
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v)
  }
  const suffix = qs.toString()
  redirect(suffix ? `/competitive-report?${suffix}` : '/competitive-report')
}

