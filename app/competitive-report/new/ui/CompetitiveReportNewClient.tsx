"use client"

import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/components/ui/use-toast'

type GenerateResponse =
  | { ok: true; data: { reportId: string } }
  | { ok: false; error: { code: string; message: string; requestId?: string } }

function parseOptionalDomainOrUrl(raw: string): { company_domain: string | null; input_url: string | null } {
  const v = raw.trim()
  if (!v) return { company_domain: null, input_url: null }
  if (/^https?:\/\//i.test(v)) return { company_domain: null, input_url: v }
  // domain-like
  if (v.includes('.')) return { company_domain: v.replace(/^www\./i, ''), input_url: null }
  return { company_domain: null, input_url: null }
}

export function CompetitiveReportNewClient() {
  const router = useRouter()
  const { toast } = useToast()

  const [companyName, setCompanyName] = useState('')
  const [domainOrUrl, setDomainOrUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const parsed = useMemo(() => parseOptionalDomainOrUrl(domainOrUrl), [domainOrUrl])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = companyName.trim()
    if (!name) {
      toast({ variant: 'destructive', title: 'Company name required', description: 'Enter a company name to generate a report.' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/competitive-report/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: name,
          company_domain: parsed.company_domain,
          input_url: parsed.input_url,
        }),
      })

      const json = (await res.json()) as GenerateResponse
      if (!json || typeof json !== 'object' || !('ok' in json)) {
        toast({ variant: 'destructive', title: 'Unexpected response', description: 'Please try again.' })
        return
      }

      if (!json.ok) {
        toast({
          variant: 'destructive',
          title: 'Report generation failed',
          description: json.error?.message || 'Please try again.',
        })
        return
      }

      const reportId = json.data.reportId
      const href = `/competitive-report?id=${encodeURIComponent(reportId)}`
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">New report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generates a structured competitive intelligence report. If no verified signals are available, the report is framework-based and includes a
            verification checklist.
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
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Google"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domainOrUrl">Company domain or URL (optional)</Label>
              <Input
                id="domainOrUrl"
                value={domainOrUrl}
                onChange={(e) => setDomainOrUrl(e.target.value)}
                placeholder="google.com or https://google.com"
                autoComplete="off"
              />
              <div className="text-xs text-muted-foreground">
                Used only to match verified signals already in your LeadIntel account. If you don’t have signals, it still generates a useful report.
              </div>
            </div>

            <Button type="submit" className="neon-border hover:glow-effect" disabled={isSubmitting}>
              {isSubmitting ? 'Generating…' : 'Generate report'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

