'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Check, Copy, Loader2, RefreshCcw, Sparkles } from 'lucide-react'

type PitchOutputs = {
  shortEmailOpener: string
  fullColdEmail: string
  linkedinDm: string
  painPointSummary: string
  recommendedOfferAngle: string
  objectionHandlingNotes: string
}

type UsageSummary = {
  tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  used: number
  limit: number | null
  remaining: number | null
  window: 'monthly'
  windowStart: string
}

type LatestGeneration = {
  id: string
  outputs: PitchOutputs
  model: string
  promptVersion: string
  tokens: { prompt: number; completion: number; total: number }
  estimatedCostUsd: number
  generatedAt: string
}

type GetEnvelope =
  | {
      ok: true
      data: {
        generation: LatestGeneration | null
        usage: UsageSummary
      }
    }
  | {
      ok: false
      error?: { message?: string; code?: string }
    }

type PostEnvelope =
  | {
      ok: true
      data: {
        generation: LatestGeneration
        usage: UsageSummary
      }
    }
  | {
      ok: false
      error?: { message?: string; code?: string; details?: unknown }
    }

type LeadAiPitchPanelProps = {
  leadId: string
  companyName: string | null | undefined
}

type CopyTarget = keyof PitchOutputs

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function sanitizeInput(value: string): string {
  return value.trim()
}

export function LeadAiPitchPanel({ leadId, companyName }: LeadAiPitchPanelProps) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latest, setLatest] = useState<LatestGeneration | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [copiedKey, setCopiedKey] = useState<CopyTarget | null>(null)
  const [painPoint, setPainPoint] = useState('')
  const [offerService, setOfferService] = useState('')
  const [campaignObjective, setCampaignObjective] = useState('')
  const [callToAction, setCallToAction] = useState('')

  const canGenerate = useMemo(() => {
    if (!usage) return true
    if (usage.limit === null) return true
    return (usage.remaining ?? 0) > 0
  }, [usage])

  const loadLatest = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/ai-pitch`, {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as GetEnvelope | null
      if (!response.ok || !payload || payload.ok !== true) {
        const message =
          payload && payload.ok === false
            ? payload.error?.message ?? 'Unable to load AI pitch generation.'
            : 'Unable to load AI pitch generation.'
        setError(message)
        return
      }
      setLatest(payload.data.generation)
      setUsage(payload.data.usage)
    } catch {
      setError('Unable to load AI pitch generation.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const handleGenerate = async (regenerate: boolean) => {
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/ai-pitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regenerate,
          promptInput: {
            painPoint: sanitizeInput(painPoint) || undefined,
            offerService: sanitizeInput(offerService) || undefined,
            campaignObjective: sanitizeInput(campaignObjective) || undefined,
            callToAction: sanitizeInput(callToAction) || undefined,
          },
        }),
      })
      const payload = (await response.json().catch(() => null)) as PostEnvelope | null
      if (!response.ok || !payload || payload.ok !== true) {
        const message =
          payload && payload.ok === false
            ? payload.error?.message ?? 'AI pitch generation failed.'
            : 'AI pitch generation failed.'
        setError(message)
        return
      }
      setLatest(payload.data.generation)
      setUsage(payload.data.usage)
    } catch {
      setError('AI pitch generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (key: CopyTarget) => {
    if (!latest) return
    const text = latest.outputs[key]
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 1200)
    } catch {
      // fail-soft
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">AI pitch generation</CardTitle>
          {usage ? (
            <Badge variant="outline">
              {usage.tier}
              {' '}
              {usage.limit !== null ? `${usage.used}/${usage.limit}` : `${usage.used}`}
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          Generate multi-channel outreach for
          {' '}
          {companyName ?? 'this lead'}
          {' '}
          with server-side AI only.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={painPoint}
            onChange={(event) => setPainPoint(event.target.value)}
            placeholder="Pain point focus (optional)"
          />
          <Input
            value={offerService}
            onChange={(event) => setOfferService(event.target.value)}
            placeholder="Offer/service focus (optional)"
          />
          <Input
            value={campaignObjective}
            onChange={(event) => setCampaignObjective(event.target.value)}
            placeholder="Campaign objective (optional)"
          />
          <Input
            value={callToAction}
            onChange={(event) => setCallToAction(event.target.value)}
            placeholder="Call-to-action preference (optional)"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleGenerate(false)}
            disabled={loading || generating || !canGenerate}
            className="neon-border hover:glow-effect"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate pitches
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleGenerate(true)}
            disabled={loading || generating || !canGenerate}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button type="button" variant="ghost" onClick={() => void loadLatest()} disabled={loading || generating}>
            Refresh
          </Button>
        </div>

        {!canGenerate ? (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Usage limit reached for your current plan window.
          </div>
        ) : null}

        {error ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
        ) : null}

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading AI generation...</div>
        ) : null}

        {latest ? (
          <div className="space-y-3">
            <div className="rounded border border-cyan-500/10 bg-background/30 p-3 text-xs text-muted-foreground">
              <div>Generated: {formatDate(latest.generatedAt)}</div>
              <div>Model: {latest.model}</div>
              <div>
                Tokens: {latest.tokens.total} (prompt {latest.tokens.prompt}, completion {latest.tokens.completion}) -
                {' '}
                {formatUsd(latest.estimatedCostUsd)}
              </div>
            </div>

            {(Object.keys(latest.outputs) as Array<keyof PitchOutputs>).map((key) => (
              <div key={key} className="rounded border border-cyan-500/10 bg-background/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-medium capitalize text-cyan-300">{key.replace(/([A-Z])/g, ' $1')}</div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy(key)}>
                    {copiedKey === key ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Textarea value={latest.outputs[key]} readOnly className="min-h-24 text-xs" />
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
