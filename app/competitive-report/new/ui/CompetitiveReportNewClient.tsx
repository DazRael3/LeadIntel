"use client"

import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UsageMeter } from '@/components/billing/UsageMeter'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type GenerateResponse =
  | {
      ok: true
      data: { reportId: string; isBlurred?: boolean; usage?: { used: number; limit: number; remaining: number } }
    }
  | { ok: false; error: { code: string; message: string; details?: { tips?: string[] } ; requestId?: string } }

function pickFirstNonEmpty(sp: URLSearchParams, keys: string[]): string | null {
  for (const k of keys) {
    const v = sp.get(k)
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function parseAuto(raw: string | null): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function CompetitiveReportNewClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const { toast } = useToast()

  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [ticker, setTicker] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inlineError, setInlineError] = useState<{ title: string; tips: string[] } | null>(null)
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null)

  const websiteRef = useRef<HTMLInputElement | null>(null)
  const didAutoSubmit = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/usage/premium-generations', { method: 'GET', cache: 'no-store', credentials: 'include' })
        if (!res.ok) return
        const json = (await res.json()) as { ok?: boolean; data?: { usage?: { used: number; limit: number; remaining: number } } }
        if (!json?.ok) return
        if (cancelled) return
        const u = json.data?.usage
        if (u) setUsage(u)
      } catch {
        // ignore
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const company = pickFirstNonEmpty(sp, ['company', 'name', 'company_name'])
    const url = pickFirstNonEmpty(sp, ['url', 'input_url', 'website', 'domain'])
    const symbol = pickFirstNonEmpty(sp, ['ticker', 'symbol'])

    setCompanyName(company ?? '')
    setWebsiteUrl(url ?? '')
    setTicker(symbol ?? '')
    // Only run on mount; we intentionally do not keep syncing with search params after user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = useMemo(() => {
    return companyName.trim().length > 0 || websiteUrl.trim().length > 0 || ticker.trim().length > 0
  }, [companyName, ticker, websiteUrl])

  async function submit() {
    setInlineError(null)

    const name = companyName.trim()
    const url = websiteUrl.trim()
    const t = ticker.trim()
    if (!canSubmit) {
      toast({ variant: 'destructive', title: 'Missing input', description: 'Enter a company name, website URL, or ticker.' })
      return
    }

    setIsSubmitting(true)
    try {
      if (usage && usage.remaining <= 0) {
        setInlineError({
          title: 'You’ve used all 3 free generations.',
          tips: ['Upgrade to unlock unlimited generation and full report access.'],
        })
        track('premium_generation_blocked_free_limit', { surface: 'competitive_report_new', used: usage.used, limit: usage.limit })
        return
      }

      const res = await fetch('/api/competitive-report/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: name.length > 0 ? name : null,
          input_url: url.length > 0 ? url : null,
          ticker: t.length > 0 ? t : null,
        }),
      })

      const json = (await res.json()) as GenerateResponse
      if (!json || typeof json !== 'object' || !('ok' in json)) {
        toast({ variant: 'destructive', title: 'Unexpected response', description: 'Please try again.' })
        return
      }

      if (!json.ok) {
        if (res.status === 422 && json.error?.code === 'NO_SOURCES_FOUND') {
          setInlineError({
            title: json.error.message || 'Not enough sources to build a report.',
            tips: json.error.details?.tips ?? [
              'Add a company website URL for best results.',
              'If the company is public, add the ticker symbol.',
              'Try again in a minute—sources may be temporarily unavailable.',
            ],
          })
          websiteRef.current?.focus()
          return
        }
        if (res.status === 429 && json.error?.code === 'FREE_TIER_GENERATION_LIMIT_REACHED') {
          const used = Number((json as any)?.error?.details?.usage?.used ?? usage?.used ?? 3) || 3
          const limit = Number((json as any)?.error?.details?.usage?.limit ?? usage?.limit ?? 3) || 3
          setUsage({ used, limit, remaining: 0 })
          setInlineError({
            title: json.error.message || 'Report limit reached.',
            tips: [
              'Free includes up to 3 total pitches/reports.',
              'Upgrade to create unlimited assets and unlock full content.',
              'You can still view your existing reports in the Reports hub.',
            ],
          })
          track('premium_generation_blocked_free_limit', { surface: 'competitive_report_new', used, limit })
          return
        }
        toast({
          variant: 'destructive',
          title: 'Report generation failed',
          description: json.error?.message || 'Please try again.',
        })
        return
      }

      const reportId = json.data.reportId
      const href = `/competitive-report?id=${encodeURIComponent(reportId)}`
      if (json.data.usage) setUsage(json.data.usage)
      track('premium_generation_completed', { type: 'report', blurred: Boolean(json.data.isBlurred), surface: 'competitive_report_new' })
      toast({
        variant: 'success',
        title: 'Report saved',
        description: 'Your competitive report is ready.',
        action: (
          <ToastAction altText="View report" onClick={() => router.push(href)}>
            View report
          </ToastAction>
        ),
      })
      router.push(href)
    } catch {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await submit()
  }

  useEffect(() => {
    const auto = parseAuto(sp.get('auto'))
    if (!auto) return
    if (didAutoSubmit.current) return
    if (!canSubmit) return
    didAutoSubmit.current = true
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">New report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Competitive reports require real-world sources. Add a website URL or ticker to ensure the report can be fully sourced.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/competitive-report">Back to reports</Link>
          </Button>
        </div>
      </div>

      <Card className="mt-6 border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Report input</CardTitle>
        </CardHeader>
        <CardContent>
          {usage ? <div className="mb-4"><UsageMeter used={usage.used} limit={usage.limit} label="Free: premium generations" eventContext={{ surface: 'competitive_report_new' }} /></div> : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            {inlineError ? (
              <div className="rounded border border-cyan-500/10 bg-card/30 p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{inlineError.title}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {inlineError.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="companyName">Company name (optional)</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Google"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL (recommended)</Label>
              <Input
                id="websiteUrl"
                ref={(el) => {
                  websiteRef.current = el
                }}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://google.com (or google.com)"
                autoComplete="off"
              />
              <div className="text-xs text-muted-foreground">
                Used to fetch first-party sources and hiring signals. We never guess a domain from the company name.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker (public companies)</Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="GOOG"
                autoComplete="off"
              />
              <div className="text-xs text-muted-foreground">Used to fetch SEC filings as citations when available.</div>
            </div>

            <Button type="submit" className="neon-border hover:glow-effect" disabled={isSubmitting || !canSubmit || (usage?.remaining ?? 1) <= 0}>
              {isSubmitting ? 'Generating…' : 'Generate report'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

