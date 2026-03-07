import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyTextButton } from '@/components/admin/CopyTextButton'
import { createClient } from '@/lib/supabase/server'
import { DownloadMarkdownButton } from './ui/DownloadMarkdownButton'

export const metadata: Metadata = {
  title: 'Competitive Intelligence Report | LeadIntel',
  description:
    'Learn how LeadIntel turns near real-time buying signals into AI-generated pitches, battlecards, and watchlists to help you create pipeline faster.',
}

export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

type UserReportRow = {
  id: string
  created_at: string
  updated_at: string
  status: 'draft' | 'complete' | 'failed'
  company_name: string
  company_domain: string | null
  input_url: string | null
  title: string
  report_markdown: string
  meta: unknown
}

function pickString(sp: SearchParams, key: string): string | null {
  const v = sp[key]
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return null
}

function safeQueryLike(q: string): string {
  return q.replace(/[%_]/g, '').slice(0, 80)
}

function statusBadge(status: string) {
  const v = status.toLowerCase()
  const variant = v === 'complete' ? 'outline' : v === 'failed' ? 'destructive' : 'secondary'
  return <Badge variant={variant as 'outline' | 'secondary' | 'destructive'}>{status}</Badge>
}

export default async function CompetitiveReportPage(props: { searchParams?: Promise<SearchParams> }) {
  const sp = (await props.searchParams) ?? {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?mode=signin&redirect=/competitive-report')
  }

  const qRaw = pickString(sp, 'q')
  const q = qRaw ? safeQueryLike(qRaw) : null
  const status = pickString(sp, 'status')
  const id = pickString(sp, 'id')

  let listQuery = supabase
    .from('user_reports')
    .select('id, created_at, status, company_name, company_domain, title')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status && (status === 'complete' || status === 'failed' || status === 'draft')) {
    listQuery = listQuery.eq('status', status)
  }
  if (q) {
    listQuery = listQuery.or(`company_name.ilike.%${q}%,company_domain.ilike.%${q}%`)
  }

  const { data: listRows } = await listQuery

  const list = (listRows ?? []) as Array<{
    id: string
    created_at: string
    status: string
    company_name: string
    company_domain: string | null
    title: string
  }>

  const selectedId = id ?? list[0]?.id ?? null

  let selected: UserReportRow | null = null
  if (selectedId) {
    const { data } = await supabase
      .from('user_reports')
      .select('id, created_at, updated_at, status, company_name, company_domain, input_url, title, report_markdown, meta')
      .eq('id', selectedId)
      .maybeSingle()
    selected = (data ?? null) as UserReportRow | null
  }

  const searchParamsForLinks = new URLSearchParams()
  if (qRaw) searchParamsForLinks.set('q', qRaw)
  if (status) searchParamsForLinks.set('status', status)

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
      <main className="container mx-auto px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Reports</h1>
            <p className="text-sm text-muted-foreground mt-2">Your competitive reports, saved per account for quick reopening.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="neon-border hover:glow-effect">
              <Link href="/pitch">New report</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Your reports</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form className="grid grid-cols-1 gap-2" method="GET" action="/competitive-report">
                  <input
                    name="q"
                    defaultValue={qRaw ?? ''}
                    className="h-9 w-full rounded border border-cyan-500/20 bg-background px-3 text-sm"
                    placeholder="Search by company"
                  />
                  <select
                    name="status"
                    defaultValue={status ?? ''}
                    className="h-9 w-full rounded border border-cyan-500/20 bg-background px-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    <option value="complete">Complete</option>
                    <option value="failed">Failed</option>
                    <option value="draft">Draft</option>
                  </select>
                  <Button size="sm" variant="outline">
                    Filter
                  </Button>
                </form>

                {list.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No saved reports yet. Generate one from <Link className="text-cyan-400 hover:underline" href="/pitch">Pitch</Link>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map((r) => {
                      const params = new URLSearchParams(searchParamsForLinks)
                      params.set('id', r.id)
                      const active = selectedId === r.id
                      return (
                        <Link
                          key={r.id}
                          href={`/competitive-report?${params.toString()}`}
                          className={`block rounded border px-3 py-2 transition-colors ${
                            active ? 'border-cyan-500/30 bg-background/60' : 'border-cyan-500/10 bg-background/30 hover:bg-background/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">{r.company_name}</div>
                              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                            </div>
                            <div className="shrink-0">{statusBadge(r.status)}</div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <Card className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{selected?.title ?? 'Select a report'}</CardTitle>
                    {selected ? (
                      <div className="text-xs text-muted-foreground">
                        {selected.company_name}
                        {selected.company_domain ? ` · ${selected.company_domain}` : ''} · {new Date(selected.created_at).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                  {selected ? (
                    <div className="flex items-center gap-2">
                      {statusBadge(selected.status)}
                      <CopyTextButton text={selected.report_markdown} />
                      <DownloadMarkdownButton filename={`${selected.company_name.replace(/[^a-z0-9_-]+/gi, '_')}.md`} markdown={selected.report_markdown} />
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <pre className="whitespace-pre-wrap break-words text-sm text-foreground/90 leading-relaxed">{selected.report_markdown}</pre>
                ) : selectedId ? (
                  <div className="text-sm text-muted-foreground">
                    Report not found, or you don’t have access to it.
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Choose a report from the list, or generate a new one from{' '}
                    <Link className="text-cyan-400 hover:underline" href="/pitch">
                      Pitch
                    </Link>
                    .
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

