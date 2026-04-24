'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type LeadGenerationResponse = {
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
}

type LeadGenerationWorkflowProps = {
  onGenerated: () => Promise<void> | void
}

export function LeadGenerationWorkflow({ onGenerated }: LeadGenerationWorkflowProps) {
  const [targetIndustry, setTargetIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [painPoint, setPainPoint] = useState('')
  const [offerService, setOfferService] = useState('')
  const [numberOfLeads, setNumberOfLeads] = useState('10')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LeadGenerationResponse | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
      await onGenerated()
    } catch {
      setError('Lead generation failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/40">
      <CardHeader>
        <CardTitle className="text-base bloomberg-font neon-cyan">Lead Generation Workflow</CardTitle>
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
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
