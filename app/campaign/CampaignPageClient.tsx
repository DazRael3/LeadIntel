'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type CampaignStatus = 'new' | 'contacted' | 'responded' | 'closed' | 'active' | 'paused' | 'archived'

type CampaignLead = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  prospect_email: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

type Campaign = {
  id: string
  name: string
  objective: string | null
  status: CampaignStatus
  created_at: string
  updated_at: string
  leadCount?: number
  leads?: CampaignLead[]
}

type CampaignProgress = {
  total: number
  byStatus: Record<CampaignStatus, number>
  completionPct: number
}

type DiscoverLead = {
  id: string
  companyName: string
  companyDomain: string | null
  companyUrl: string | null
}

function asErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Request failed'
  const error = (payload as { error?: { message?: unknown } }).error
  if (!error || typeof error !== 'object') return 'Request failed'
  return typeof error.message === 'string' && error.message.length > 0 ? error.message : 'Request failed'
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function statusBadgeVariant(status: CampaignStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'responded' || status === 'closed' || status === 'active') return 'default'
  if (status === 'paused') return 'secondary'
  return 'outline'
}

export function CampaignPageClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [leadOptions, setLeadOptions] = useState<DiscoverLead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<CampaignProgress | null>(null)

  const selectedLeadIdsArray = useMemo(() => Array.from(selectedLeadIds), [selectedLeadIds])

  const loadCampaigns = useCallback(async () => {
    const response = await fetch('/api/campaigns?includeLeads=true', { cache: 'no-store' })
    const payload = await parseJsonSafe(response)
    if (!response.ok) throw new Error(asErrorMessage(payload))
    const campaignsPayload = (payload as { data?: { campaigns?: Campaign[] } })?.data?.campaigns
    setCampaigns(Array.isArray(campaignsPayload) ? campaignsPayload : [])
    const progressPayload = (payload as { data?: { campaignProgress?: CampaignProgress } })?.data?.campaignProgress
    setProgress(progressPayload ?? null)
  }, [])

  const loadLeadOptions = useCallback(async () => {
    const response = await fetch('/api/leads/discover', { cache: 'no-store' })
    const payload = await parseJsonSafe(response)
    if (!response.ok) throw new Error(asErrorMessage(payload))
    const leadsPayload = (payload as { data?: { leads?: DiscoverLead[] } })?.data?.leads
    setLeadOptions(Array.isArray(leadsPayload) ? leadsPayload : [])
  }, [])

  const refreshAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await Promise.all([loadCampaigns(), loadLeadOptions()])
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load campaigns')
    } finally {
      setIsLoading(false)
    }
  }, [loadCampaigns, loadLeadOptions])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0) {
      setError('Campaign name is required.')
      return
    }

    setIsSaving(true)
    setError(null)
    setActionMessage(null)
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          objective: objective.trim().length > 0 ? objective.trim() : null,
          leadIds: selectedLeadIdsArray,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        throw new Error(asErrorMessage(payload))
      }

      setName('')
      setObjective('')
      setSelectedLeadIds(new Set())
      setActionMessage('Campaign saved.')
      await refreshAll()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create campaign')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCampaignAction(campaignId: string, action: 'attach_leads' | 'detach_lead' | 'export', leadId?: string) {
    setActionMessage(null)
    setError(null)
    try {
      const payload: Record<string, unknown> = action === 'export' ? {} : { action }
      if (action === 'attach_leads') payload.leadIds = selectedLeadIdsArray
      if (action === 'detach_lead' && leadId) payload.leadId = leadId

      const endpoint =
        action === 'export' ? `/api/campaigns/${campaignId}/export` : `/api/campaigns/${campaignId}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await parseJsonSafe(response)
      if (!response.ok) {
        throw new Error(asErrorMessage(json))
      }

      if (action === 'export') {
        const data = (json as { data?: { downloadUrl?: string; inlineCsv?: string } })?.data
        if (typeof data?.downloadUrl === 'string') {
          window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
          setActionMessage('Campaign export started.')
        } else if (typeof data?.inlineCsv === 'string') {
          const blob = new Blob([data.inlineCsv], { type: 'text/csv' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `campaign-${campaignId}.csv`
          link.click()
          window.URL.revokeObjectURL(url)
          setActionMessage('Campaign CSV downloaded.')
        } else {
          setActionMessage('Campaign export completed.')
        }
      } else {
        setActionMessage('Campaign updated.')
      }

      await refreshAll()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Campaign action failed')
    }
  }

  async function handleStatusChange(campaign: Campaign, status: CampaignStatus): Promise<void> {
    if (campaign.status === status) return
    setError(null)
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) throw new Error(asErrorMessage(payload))
      setActionMessage(`Campaign marked ${status}.`)
      await refreshAll()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update campaign')
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader>
          <CardTitle>Create campaign</CardTitle>
          <CardDescription>
            Save campaign state and attach leads so your team can return later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleCreateCampaign(event)}>
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Q2 Trigger Outreach"
                maxLength={160}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="campaign-objective">Objective</Label>
              <Textarea
                id="campaign-objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                placeholder="Who this campaign targets and what success looks like."
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>Attach leads</Label>
              {leadOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved leads available yet.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2 rounded border border-cyan-500/10 p-3">
                  {leadOptions.map((lead) => {
                    const checked = selectedLeadIds.has(lead.id)
                    return (
                      <label key={lead.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedLeadIds((prev) => {
                              const next = new Set(prev)
                              if (event.target.checked) next.add(lead.id)
                              else next.delete(lead.id)
                              return next
                            })
                          }}
                        />
                        <span className="text-foreground">{lead.companyName}</span>
                        {lead.companyDomain ? <span>({lead.companyDomain})</span> : null}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save campaign'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {actionMessage ? <p className="text-sm text-cyan-300">{actionMessage}</p> : null}

      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader>
          <CardTitle>Saved campaigns</CardTitle>
          <CardDescription>Re-open campaigns and export lead lists when your plan allows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress ? (
            <div className="grid gap-2 rounded border border-cyan-500/10 bg-background/40 p-3 sm:grid-cols-3">
              <div className="text-xs text-muted-foreground">Total campaigns: <span className="text-foreground">{progress.total}</span></div>
              <div className="text-xs text-muted-foreground">
                Awaiting action:{' '}
                <span className="text-foreground">
                  {(progress.byStatus.new ?? 0) + (progress.byStatus.contacted ?? 0)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Progress complete: <span className="text-foreground">{progress.completionPct}%</span>
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns saved yet.</p>
          ) : (
            campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded border border-cyan-500/10 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{campaign.name}</div>
                    {campaign.objective ? (
                      <p className="text-sm text-muted-foreground mt-1">{campaign.objective}</p>
                    ) : null}
                  </div>
                  <Badge variant={statusBadgeVariant(campaign.status)}>{campaign.status}</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={campaign.status}
                    className="rounded border border-cyan-500/20 bg-background px-2 py-1 text-sm"
                    onChange={(event) => void handleStatusChange(campaign, event.target.value as CampaignStatus)}
                  >
                    <option value="new">new</option>
                    <option value="contacted">contacted</option>
                    <option value="responded">responded</option>
                    <option value="closed">closed</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCampaignAction(campaign.id, 'attach_leads')}
                    disabled={selectedLeadIdsArray.length === 0}
                  >
                    Attach selected leads
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleCampaignAction(campaign.id, 'export')}>
                    Export campaign
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Leads ({campaign.leadCount ?? campaign.leads?.length ?? 0})
                  </div>
                  {campaign.leads && campaign.leads.length > 0 ? (
                    <ul className="space-y-2">
                      {campaign.leads.map((lead) => (
                        <li key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                          <span>
                            {lead.company_name ?? 'Unknown company'}
                            {lead.company_domain ? (
                              <span className="text-muted-foreground"> ({lead.company_domain})</span>
                            ) : null}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleCampaignAction(campaign.id, 'detach_lead', lead.id)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No leads attached yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
