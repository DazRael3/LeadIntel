"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function pickFirstNonEmpty(sp: URLSearchParams, keys: string[]): string | null {
  for (const k of keys) {
    const v = sp.get(k)
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function parseBoolish(raw: string | null): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function CreateReportPanelClient(props: { open?: boolean }) {
  const router = useRouter()
  const sp = useSearchParams()
  const didInit = useRef(false)

  const [open, setOpen] = useState(Boolean(props.open))
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [ticker, setTicker] = useState('')

  useEffect(() => {
    if (props.open) setOpen(true)
  }, [props.open])

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    const company = pickFirstNonEmpty(sp, ['company', 'name', 'company_name'])
    const url = pickFirstNonEmpty(sp, ['url', 'input_url', 'website', 'domain'])
    const symbol = pickFirstNonEmpty(sp, ['ticker', 'symbol'])
    setCompanyName(company ?? '')
    setWebsiteUrl(url ?? '')
    setTicker(symbol ?? '')
    // open panel when explicit `create=1` (or legacy `new=1`)
    if (parseBoolish(sp.get('create')) || parseBoolish(sp.get('new'))) setOpen(true)
  }, [sp])

  const canGenerate = useMemo(() => {
    return companyName.trim().length > 0 || websiteUrl.trim().length > 0 || ticker.trim().length > 0
  }, [companyName, ticker, websiteUrl])

  function closePanel() {
    setOpen(false)
    const params = new URLSearchParams(sp.toString())
    params.delete('create')
    params.delete('new')
    router.replace(params.toString().length ? `/competitive-report?${params.toString()}` : '/competitive-report')
  }

  function onGenerate() {
    if (!canGenerate) return
    const params = new URLSearchParams()
    if (companyName.trim()) params.set('company', companyName.trim())
    if (websiteUrl.trim()) params.set('url', websiteUrl.trim())
    if (ticker.trim()) params.set('ticker', ticker.trim())
    params.set('auto', '1')
    // Clear any selected report id; this is a new generation request.
    params.delete('id')
    router.push(`/competitive-report?${params.toString()}`)
    setOpen(false)
  }

  if (!open) {
    return null
  }

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Create report</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Add a website URL or ticker to ensure the report includes real citations.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={closePanel}>
              Cancel
            </Button>
            <Button size="sm" className="neon-border hover:glow-effect" disabled={!canGenerate} onClick={onGenerate}>
              Generate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="cr_company">Company name</Label>
          <Input id="cr_company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acer" />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="cr_ticker">Ticker (optional)</Label>
          <Input id="cr_ticker" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="ACER" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="cr_url">Website URL (recommended)</Label>
          <Input
            id="cr_url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://acer.com"
          />
        </div>
      </CardContent>
    </Card>
  )
}

