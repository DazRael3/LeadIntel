'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Loader2, Mail } from 'lucide-react'

type DemoTryResponse = {
  company: string
  icp: string | null
  digestLines: string[]
  pitchSubject: string
  pitchBody: string
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function TryLeadIntel() {
  const [company, setCompany] = useState('')
  const [icp, setIcp] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DemoTryResponse | null>(null)

  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  const canGenerate = company.trim().length > 0 && !isLoading
  const canEmail = Boolean(result) && email.trim().length > 3 && emailStatus !== 'sending'

  const digestText = useMemo(() => (result ? result.digestLines.join('\n') : ''), [result])

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    setEmailStatus('idle')
    try {
      const res = await fetch('/api/demo/try', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), icp: icp.trim() || null }),
      })
      const raw = await res.text()
      const payload = raw.trim() ? safeJsonParse(raw) : null
      const data = (payload as any)?.data ?? payload
      if (!res.ok) {
        setError((payload as any)?.error?.message ?? 'Failed to generate demo. Please try again.')
        setResult(null)
        return
      }
      setResult(data as DemoTryResponse)
    } catch {
      setError('Failed to generate demo. Please try again.')
      setResult(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmail = async () => {
    if (!result) return
    setEmailStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/demo/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          company: result.company,
          digestLines: result.digestLines,
        }),
      })
      const raw = await res.text()
      const payload = raw.trim() ? safeJsonParse(raw) : null
      const data = (payload as any)?.data ?? payload
      if (!res.ok || !data?.sent) {
        setError('Email delivery is temporarily unavailable. Please sign up to receive digests in-app.')
        setEmailStatus('idle')
        return
      }
      setEmailStatus('sent')
    } catch {
      setError('Email delivery is temporarily unavailable. Please sign up to receive digests in-app.')
      setEmailStatus('idle')
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Try it (no signup)</CardTitle>
        <div className="text-xs text-muted-foreground">
          Generate a 1‑company sample digest + pitch. Then email the digest to yourself.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>{error}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="demo-company">Company</Label>
            <Input
              id="demo-company"
              placeholder="e.g. Visa, Snowflake, acme.com"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-icp">ICP (optional)</Label>
            <Input
              id="demo-icp"
              placeholder="e.g. Mid-market B2B SaaS sales teams"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={() => void handleGenerate()} disabled={!canGenerate} className="neon-border hover:glow-effect">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            'Generate sample digest + pitch'
          )}
        </Button>

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-cyan-500/10 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample digest</div>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-200/90 leading-relaxed">
                {digestText}
              </pre>
            </div>
            <div className="rounded-lg border border-cyan-500/10 bg-slate-950/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample pitch</div>
              <div className="mt-2 text-xs text-slate-200/90">
                <div className="font-mono">Subject: {result.pitchSubject}</div>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed">{result.pitchBody}</pre>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-cyan-500/10 bg-card/40 p-4">
            <div className="text-sm font-medium">Email me the digest</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Get this sample in your inbox. Full digests require an account.
            </div>
            <div className="mt-3 flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canEmail}
                onClick={() => void handleEmail()}
                className="neon-border hover:glow-effect"
              >
                {emailStatus === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : emailStatus === 'sent' ? (
                  'Sent'
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Email me the digest
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

