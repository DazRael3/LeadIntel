'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

export type LeadGenerationResponse = {
  strategy: {
    query: string
    rationale: string
    channels: string[]
    enrichmentNotes: string
  }
  generation: {
    inserted: number
    duplicatesRemoved: number
    duplicatesAgainstExisting: number
    mergedDuplicates: number
    warning: string | null
  }
  usage: {
    tier: 'starter' | 'closer' | 'closer_plus' | 'team'
    used: number
    limit: number | null
    remaining: number | null
  }
  savedSearch: {
    id: string
    name: string
    lastRunAt: string
  } | null
}

type UpgradePrompt = {
  title: string
  body: string
  cta: string
  href: string
}

type LeadGenerationWorkflowProps = {
  onGenerated: () => Promise<void> | void
  preset?: {
    targetIndustry: string
    location: string
    companySize: string
    targetRole: string
    painPoint: string
    offerService: string
    numberOfLeads: number
    savedSearchId?: string
  } | null
  defaultSavedSearchId?: string | null
  modeLabel?: string
  runSignal?: number
  onResult?: (result: LeadGenerationResponse) => void
  onPayloadChange?: (payload: {
    targetIndustry: string
    location: string
    companySize: string
    targetRole: string
    painPoint: string
    offerService: string
    numberOfLeads: number
  }) => void
}

export function LeadGenerationWorkflow({
  onGenerated,
  preset = null,
  defaultSavedSearchId = null,
  modeLabel = 'Lead Generation Workflow',
  runSignal = 0,
  onResult,
  onPayloadChange,
}: LeadGenerationWorkflowProps) {
  const [targetIndustry, setTargetIndustry] = useState(preset?.targetIndustry ?? '')
  const [location, setLocation] = useState(preset?.location ?? '')
  const [companySize, setCompanySize] = useState(preset?.companySize ?? '')
  const [targetRole, setTargetRole] = useState(preset?.targetRole ?? '')
  const [painPoint, setPainPoint] = useState(preset?.painPoint ?? '')
  const [offerService, setOfferService] = useState(preset?.offerService ?? '')
  const [numberOfLeads, setNumberOfLeads] = useState(String(preset?.numberOfLeads ?? 10))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LeadGenerationResponse | null>(null)
  const lastRunSignal = useRef(runSignal)
  const [showLeadResultUpgradePrompt, setShowLeadResultUpgradePrompt] = useState(false)

  useEffect(() => {
    setTargetIndustry(preset?.targetIndustry ?? '')
    setLocation(preset?.location ?? '')
    setCompanySize(preset?.companySize ?? '')
    setTargetRole(preset?.targetRole ?? '')
    setPainPoint(preset?.painPoint ?? '')
    setOfferService(preset?.offerService ?? '')
    setNumberOfLeads(String(preset?.numberOfLeads ?? 10))
  }, [preset])

  useEffect(() => {
    const requestedCount = Number.parseInt(numberOfLeads, 10)
    onPayloadChange?.({
      targetIndustry,
      location,
      companySize,
      targetRole,
      painPoint,
      offerService,
      numberOfLeads: Number.isFinite(requestedCount) ? requestedCount : 10,
    })
  }, [companySize, location, numberOfLeads, offerService, onPayloadChange, painPoint, targetIndustry, targetRole])

  const submitGeneration = async () => {
    if (isSubmitting) return
    setError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      const requestedCount = Number.parseInt(numberOfLeads, 10)
      const response = await fetch('/api/leads/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetIndustry,
          location,
          companySize,
          targetRole,
          painPoint,
          offerService,
          numberOfLeads: requestedCount,
          ...(preset?.savedSearchId || defaultSavedSearchId
            ? { savedSearchId: preset?.savedSearchId ?? defaultSavedSearchId }
            : {}),
        }),
      })
      const payload = (await response.json()) as
        | { ok: true; data: LeadGenerationResponse }
        | { ok: false; error?: { message?: string } }

      if (!response.ok || !payload || payload.ok !== true) {
        const message = payload && payload.ok === false
          ? payload.error?.message ?? 'Lead generation failed.'
          : 'Lead generation failed.'
        setError(message)
        return
      }

      setResult(payload.data)
      if (payload.data.usage.tier === 'starter') {
        setShowLeadResultUpgradePrompt(true)
      } else {
        setShowLeadResultUpgradePrompt(false)
      }
      onResult?.(payload.data)
      await onGenerated()
    } catch {
      setError('Lead generation failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const leadResultUpgradePrompt: UpgradePrompt = {
    title: 'Scale beyond limited preview',
    body: 'You’ve unlocked 3 leads. Upgrade for 50+ and full outreach sequences.',
    cta: 'Upgrade for pipeline growth',
    href: '/pricing?target=closer',
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitGeneration()
  }

  useEffect(() => {
    if (runSignal <= lastRunSignal.current) return
    lastRunSignal.current = runSignal
    void submitGeneration()
    // runSignal intentionally drives reruns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSignal])

  return (
    <Card className="border-cyan-500/20 bg-card/40">
      <CardHeader>
        <CardTitle className="text-base bloomberg-font neon-cyan">{modeLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Target industry"
              value={targetIndustry}
              onChange={(event) => setTargetIndustry(event.target.value)}
              required
            />
            <Input
              placeholder="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
            />
            <Input
              placeholder="Company size (e.g. 50-200)"
              value={companySize}
              onChange={(event) => setCompanySize(event.target.value)}
              required
            />
            <Input
              placeholder="Target role"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              required
            />
            <Input
              placeholder="Number of leads"
              type="number"
              min={1}
              max={50}
              value={numberOfLeads}
              onChange={(event) => setNumberOfLeads(event.target.value)}
              required
            />
          </div>
          <Textarea
            placeholder="Pain point"
            value={painPoint}
            onChange={(event) => setPainPoint(event.target.value)}
            required
          />
          <Textarea
            placeholder="Offer / service"
            value={offerService}
            onChange={(event) => setOfferService(event.target.value)}
            required
          />
          <Button type="submit" disabled={isSubmitting} className="neon-border hover:glow-effect">
            {isSubmitting ? 'Generating leads...' : 'Generate & Save Leads'}
          </Button>
        </form>

        {error ? (
          <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded border border-cyan-500/20 bg-background/40 p-3 text-xs space-y-2">
            <div className="font-medium text-cyan-300">Search strategy</div>
            <div className="text-muted-foreground">{result.strategy.query}</div>
            <div className="text-muted-foreground">{result.strategy.rationale}</div>
            <div className="flex flex-wrap gap-2">
              {result.strategy.channels.map((channel) => (
                <Badge key={channel} variant="outline" className="border-cyan-500/30 text-cyan-300">
                  {channel}
                </Badge>
              ))}
            </div>
            <div className="text-muted-foreground">{result.strategy.enrichmentNotes}</div>
            <div className="text-muted-foreground">
              Inserted {result.generation.inserted} leads • Deduped {result.generation.duplicatesRemoved}
              {' '}• Existing duplicates {result.generation.duplicatesAgainstExisting}
            </div>
            <div className="text-muted-foreground">
              Usage: {result.usage.used}
              {result.usage.limit ? ` / ${result.usage.limit}` : ''} leads used
              {result.usage.remaining !== null ? ` • ${result.usage.remaining} remaining` : ''}
            </div>
            {result.savedSearch ? (
              <div className="text-muted-foreground">
                Saved search run tracked: {result.savedSearch.name}
              </div>
            ) : null}
            {showLeadResultUpgradePrompt ? (
              <div className="rounded border border-cyan-500/20 bg-cyan-500/5 p-2">
                <div className="font-medium text-cyan-300">{leadResultUpgradePrompt.title}</div>
                <div className="mt-1 text-muted-foreground">{leadResultUpgradePrompt.body}</div>
                <Button asChild size="sm" variant="outline" className="mt-2 h-7 text-xs">
                  <a href={leadResultUpgradePrompt.href}>{leadResultUpgradePrompt.cta}</a>
                </Button>
              </div>
            ) : null}
            <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
              <div className="text-xs text-foreground">Invite a friend → get more leads</div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  track('upgrade_clicked', { source: 'lead_generation_referral_hook' })
                  window.location.href = '/settings/team'
                }}
              >
                Invite a friend
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
