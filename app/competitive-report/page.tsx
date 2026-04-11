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
import { SourcesFreshnessPanelClient } from './ui/SourcesFreshnessPanelClient'
import { ReportQualityBadge } from './ui/ReportQualityBadge'
import { LegacyCitationBannerClient } from './ui/LegacyCitationBannerClient'
import { CreateReportPanelClient } from './ui/CreateReportPanelClient'
import { ReportDiffPanelClient } from './ui/ReportDiffPanelClient'
import { SourceQualitySummary } from '@/components/report/SourceQualitySummary'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { buildCompetitiveReportNewUrl } from '@/lib/reports/reportLinks'
import { getPremiumGenerationCapabilities, getPremiumGenerationUsage, redactTextPreview } from '@/lib/billing/premium-generations'
import { UsageMeter } from '@/components/billing/UsageMeter'
import { BlurredPremiumSection } from '@/components/gating/BlurredPremiumSection'
import { RecentPremiumActivityPanel } from '@/components/billing/RecentPremiumActivityPanel'

export async function generateMetadata(props: { searchParams?: Promise<SearchParams> }): Promise<Metadata> {
  const sp = (await props.searchParams) ?? {}
  const reportId = pickString(sp, 'id')
  const create = pickString(sp, 'create')
  const auto = pickString(sp, 'auto')
  const source = pickString(sp, 'source')
  const company = pickString(sp, 'company') ?? pickString(sp, 'name') ?? pickString(sp, 'company_name')
  const ticker = pickString(sp, 'ticker') ?? pickString(sp, 'symbol')
  const companyLabel = (company ?? ticker ?? '').trim().slice(0, 80)

  let title = 'Competitive Reports Hub | LeadIntel'
  let description =
    'Generate, review, and compare competitive reports backed by real citations.'

  if (source === 'reports') {
    title = 'Reports Workspace | LeadIntel'
    description = 'Legacy reports entrypoint redirected to the competitive reports workspace.'
  } else if (reportId) {
    title = 'Competitive Report Details | LeadIntel'
    description = 'Review a saved competitive report and its source quality.'
  } else if (create === '1') {
    title = 'Create Competitive Report | LeadIntel'
    description = 'Create a new competitive report from a company URL or ticker.'
  } else if (auto === '1' && companyLabel) {
    title = `Generating report for ${companyLabel} | LeadIntel`
    description = `Auto-generating a competitive report for ${companyLabel}.`
  } else if (companyLabel) {
    title = `Competitive report draft for ${companyLabel} | LeadIntel`
    description = `Prepare a competitive report draft for ${companyLabel}.`
  }

  return {
    title,
    description,
    alternates: { canonical: 'https://dazrael.com/competitive-report' },
  }
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
  sources_used: unknown
  sources_fetched_at: string | null
  report_kind: string
  report_version: number
  meta: unknown
}

type SnapshotRow = { id: string; report_markdown: string; created_at: string }

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

  const [capabilities, usage] = await Promise.all([
    getPremiumGenerationCapabilities({ supabase, userId: user.id, sessionEmail: user.email ?? null }),
    getPremiumGenerationUsage({ supabase, userId: user.id }),
  ])

  const qRaw = pickString(sp, 'q')
  const q = qRaw ? safeQueryLike(qRaw) : null
  const status = pickString(sp, 'status')
  const id = pickString(sp, 'id')
  const create = pickString(sp, 'create')
  const qpCompany = pickString(sp, 'company') ?? pickString(sp, 'name') ?? pickString(sp, 'company_name')
  const qpUrl = pickString(sp, 'url') ?? pickString(sp, 'input_url') ?? pickString(sp, 'website') ?? pickString(sp, 'domain')
  const qpTicker = pickString(sp, 'ticker') ?? pickString(sp, 'symbol')
  const queryCtaHref = buildCompetitiveReportNewUrl({ company: qpCompany, url: qpUrl, ticker: qpTicker, auto: true })
  const hasQueryCta = Boolean(qpCompany || qpUrl || qpTicker)

  let listQuery = supabase
    .from('user_reports')
    .select('id, created_at, status, company_name, company_domain, title, report_kind')
    .eq('user_id', user.id)
    .eq('report_kind', 'competitive')
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
    report_kind?: string
  }>

  const selectedId = id ?? list[0]?.id ?? null

  let selected: UserReportRow | null = null
  if (selectedId) {
    const { data } = await supabase
      .from('user_reports')
      .select(
        'id, created_at, updated_at, status, company_name, company_domain, input_url, title, report_markdown, sources_used, sources_fetched_at, report_kind, report_version, meta'
      )
      .eq('id', selectedId)
      .eq('report_kind', 'competitive')
      .maybeSingle()
    selected = (data ?? null) as UserReportRow | null
  }

  const selectedMarkdownFull = selected?.report_markdown ?? ''
  const selectedMarkdownForViewer = capabilities.blurPremiumSections ? redactTextPreview(selectedMarkdownFull, 1600) : selectedMarkdownFull
  const selectedMarkdownForCopy = selectedMarkdownForViewer

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
              <Link href="/competitive-report?create=1">New report</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <CreateReportPanelClient open={create === '1'} />
        </div>

        {capabilities.tier === 'starter' ? (
          <div className="mt-6">
            <UsageMeter
              used={usage.used}
              limit={usage.limit}
              label={capabilities.freeGenerationLabel ?? 'Free plan: 3 preview generations total'}
              helper={capabilities.freeGenerationHelper ?? 'Generate up to 3 pitch/report previews on Free.'}
              scopeHelper={capabilities.freeUsageScopeLabel ?? 'Usage is shared across pitches and reports.'}
              lockedHelper={capabilities.lockedHelper ?? 'Full premium content stays locked until you upgrade.'}
              eventContext={{ surface: 'competitive_report_hub' }}
            />
          </div>
        ) : null}

        {hasQueryCta ? (
          <Card className="mt-6 border-cyan-500/20 bg-card/60">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Create a sourced report for{' '}
                <span className="text-foreground font-medium">{qpCompany ?? qpTicker ?? 'this company'}</span>.
              </div>
              <Button asChild size="sm" className="neon-border hover:glow-effect">
                <Link href={queryCtaHref}>Create report</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6">
          <RecentPremiumActivityPanel surface="competitive_report_hub" />
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
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">No reports yet</div>
                      <div className="mt-1">
                        {capabilities.tier === 'starter' && usage.used > 0
                          ? 'No reports yet. Your current free usage may come from pitch previews or report previews generated elsewhere.'
                          : 'Generate your first sourced competitive report in under 60 seconds. Add a website URL or ticker to ensure the report includes real citations.'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild size="sm" className="neon-border hover:glow-effect">
                        <Link href={buildCompetitiveReportNewUrl({ auto: false })}>New report</Link>
                      </Button>
                      {hasQueryCta ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={queryCtaHref}>Create report for {qpCompany ?? qpTicker ?? 'this company'}</Link>
                        </Button>
                      ) : null}
                    </div>
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
                      <CopyTextButton text={selectedMarkdownForCopy} />
                      {capabilities.blurPremiumSections ? null : (
                        <DownloadMarkdownButton
                          filename={`${selected.company_name.replace(/[^a-z0-9_-]+/gi, '_')}.md`}
                          markdown={selectedMarkdownForCopy}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <div className="space-y-4" id="report-viewer">
                    <LegacyCitationBannerClient
                      reportMarkdown={selectedMarkdownForViewer}
                      companyName={selected.company_name}
                      inputUrl={selected.input_url}
                      sourcesUsed={selected.sources_used}
                      sourcesFetchedAt={selected.sources_fetched_at}
                    />
                    <ReportQualityBadge
                      reportMarkdown={selectedMarkdownForViewer}
                      sourcesUsed={selected.sources_used}
                      sourcesFetchedAt={selected.sources_fetched_at}
                      companyName={selected.company_name}
                      inputUrl={selected.input_url}
                    />
                    <SourceQualitySummary sourcesUsed={selected.sources_used} sourcesFetchedAt={selected.sources_fetched_at} meta={selected.meta} />
                    <SourcesFreshnessPanelClient
                      companyName={selected.company_name}
                      companyDomain={selected.company_domain}
                      inputUrl={selected.input_url}
                      sourcesFetchedAt={selected.sources_fetched_at}
                      sourcesUsed={selected.sources_used}
                    />
                    <ReportDiffPanelClient
                      reportId={selected.id}
                      latestMarkdown={selectedMarkdownFull}
                    />
                    {capabilities.blurPremiumSections ? (
                      <BlurredPremiumSection
                  title="Generated report preview (locked on Free)"
                        preview={selectedMarkdownForViewer}
                  lockedReason={`${capabilities.lockedHelper ?? 'Full premium content stays locked until you upgrade.'} ${
                    capabilities.freeUsageScopeLabel ?? 'Usage is shared across pitches and reports.'
                  }`}
                        upgradeHref="/pricing?target=closer"
                        eventContext={{ surface: 'competitive_report_hub', section: 'report' }}
                      />
                    ) : (
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedMarkdownForViewer}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : selectedId ? (
                  <div className="text-sm text-muted-foreground">
                    Report not found, or you don’t have access to it.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">Choose a report from the list, or generate a new one.</div>
                    <Button asChild size="sm" className="neon-border hover:glow-effect w-fit">
                      <Link href={buildCompetitiveReportNewUrl({ auto: false })}>New report</Link>
                    </Button>
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

