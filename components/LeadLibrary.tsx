'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/utils"
import { useLeadLibrary } from "@/app/dashboard/hooks/useLeadLibrary"
import { track } from '@/lib/analytics'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { formatRelativeDate, formatSignalType } from "@/lib/domain/explainability"
import { 
  Search, 
  Filter, 
  Building2, 
  Copy, 
  Check,
  X,
  Download,
  Eye,
  Star,
  Trash2
} from "lucide-react"
import { LeadDetailView } from "@/components/LeadDetailView"
import { addLeadToWatchlist } from "@/components/Watchlist"
import { computeStarterLeadUsage, STARTER_MAX_LEADS } from '@/lib/billing/leads-usage'
import { COPY } from "@/lib/copy/leadintel"
import { markUpgradeNudgeShown, shouldShowUpgradeNudge } from '@/lib/growth/nudge-cap'
import { getActiveWorkspaceIdForUser, ensureDefaultWatchlist, listWatchlistItems, removeLeadFromWatchlist as removeLeadFromWatchlistV2 } from "@/lib/watchlists-v2/service"
import { LeadGenerationWorkflow } from "@/components/LeadGenerationWorkflow"
import type { LeadGenerationResponse } from "@/components/LeadGenerationWorkflow"

type WatchlistRow = {
  lead_id: string
}

type LeadFitSummary = {
  score: number | null
  explanation: string
}

type SavedSearchRow = {
  id: string
  name: string
  query_payload: {
    targetIndustry?: string
    location?: string
    companySize?: string
    targetRole?: string
    painPoint?: string
    offerService?: string
    numberOfLeads?: number
    savedSearchId?: string
  } | null
  last_run_at: string | null
  updated_at: string
}

type LeadActivitySummary = {
  newLeadsSinceLastVisit: number
  campaignsAwaitingAction: number
}

function parseLeadFitSummary(pitch: string): LeadFitSummary {
  const firstLine = pitch.split('\n')[0] ?? ''
  const matched = firstLine.match(/^\[LeadIntel Fit (\d{1,3})\/100\]\s*(.+)$/)
  if (!matched) return { score: null, explanation: '' }
  const score = Number.parseInt(matched[1], 10)
  if (!Number.isFinite(score)) return { score: null, explanation: matched[2] ?? '' }
  return {
    score: Math.max(0, Math.min(100, score)),
    explanation: (matched[2] ?? '').trim(),
  }
}

interface LeadLibraryProps {
  isPro: boolean
  creditsRemaining: number
  viewMode?: 'startup' | 'enterprise'
}

export function LeadLibrary({ isPro, creditsRemaining: _creditsRemaining, viewMode = 'startup' }: LeadLibraryProps) {
  const supabase = createClient()
  const { leads, isLoading: loading, error, refresh } = useLeadLibrary()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null)
  const [minFitScore, setMinFitScore] = useState<number>(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [starredLeads, setStarredLeads] = useState<Set<string>>(new Set())
  const [isDeletingLeadId, setIsDeletingLeadId] = useState<string | null>(null)
  const [savedSearches, setSavedSearches] = useState<SavedSearchRow[]>([])
  const [savedSearchName, setSavedSearchName] = useState('')
  const [selectedSavedSearchId, setSelectedSavedSearchId] = useState<string | null>(null)
  const [isSavingSearch, setIsSavingSearch] = useState(false)
  const [activitySummary, setActivitySummary] = useState<LeadActivitySummary | null>(null)
  const [runAgainSignal, setRunAgainSignal] = useState(0)
  const [draftSearchPayload, setDraftSearchPayload] = useState<{
    targetIndustry: string
    location: string
    companySize: string
    targetRole: string
    painPoint: string
    offerService: string
    numberOfLeads: number
  } | null>(null)
  const hasStampedVisit = useRef(false)

  const loadStarredLeads = useCallback(async () => {
    if (!isPro) return
    
    try {
      const user = await getUserSafe(supabase)
      if (!user) return

      // Prefer Watchlists v2 when available.
      try {
        const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
        if (wsRes.ok) {
          const def = await ensureDefaultWatchlist({ supabase, workspaceId: wsRes.workspaceId, createdBy: user.id })
          if (def.ok) {
            const items = await listWatchlistItems({ supabase, workspaceId: wsRes.workspaceId, watchlistId: def.watchlistId, limit: 500 })
            setStarredLeads(new Set(items.map((it) => it.row.lead_id)))
            return
          }
        }
      } catch {
        // fall back
      }

      const { data } = await supabase
        .from('watchlist')
        .select('lead_id')
        .eq('user_id', user.id)

      if (data) {
        const rows = data as WatchlistRow[]
        setStarredLeads(new Set(rows.map((item) => item.lead_id)))
      }
    } catch (error) {
      console.error('Error loading starred leads:', error)
    }
  }, [isPro, supabase])

  useEffect(() => {
    void loadStarredLeads()
  }, [loadStarredLeads])

  const loadSavedSearches = useCallback(async () => {
    try {
      const response = await fetch('/api/saved-searches', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { savedSearches: SavedSearchRow[] } }
        | { ok: false }
        | null
      if (!response.ok || !payload || payload.ok !== true) return
      const rows = payload.data.savedSearches ?? []
      setSavedSearches(rows)
      if (rows.length > 0 && !selectedSavedSearchId) {
        setSelectedSavedSearchId(rows[0].id)
      }
    } catch {
      // fail-soft
    }
  }, [selectedSavedSearchId])

  const loadActivitySummary = useCallback(async () => {
    try {
      const response = await fetch('/api/lead-activity', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { summary: LeadActivitySummary } }
        | { ok: false }
        | null
      if (!response.ok || !payload || payload.ok !== true) return
      setActivitySummary(payload.data.summary)
    } catch {
      // fail-soft
    }
  }, [])

  const stampLeadLibraryVisit = useCallback(async () => {
    if (hasStampedVisit.current) return
    hasStampedVisit.current = true
    try {
      await fetch('/api/lead-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // fail-soft
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    void loadSavedSearches()
    void loadActivitySummary()
    void stampLeadLibraryVisit()
  }, [loadSavedSearches, loadActivitySummary, stampLeadLibraryVisit])

  useEffect(() => {
    track('lead_library_viewed')
    // fire once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleStar = async (lead: Lead) => {
    if (!isPro) return

    const isStarred = starredLeads.has(lead.id)
    
    if (isStarred) {
      // Remove from watchlist
      try {
        const user = await getUserSafe(supabase)
        if (!user) return

        // Prefer Watchlists v2 when available.
        try {
          const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
          if (wsRes.ok) {
            const def = await ensureDefaultWatchlist({ supabase, workspaceId: wsRes.workspaceId, createdBy: user.id })
            if (def.ok) {
              await removeLeadFromWatchlistV2({ supabase, workspaceId: wsRes.workspaceId, watchlistId: def.watchlistId, leadId: lead.id })
              setStarredLeads(prev => {
                const next = new Set(prev)
                next.delete(lead.id)
                return next
              })
              return
            }
          }
        } catch {
          // fall back
        }

        await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('lead_id', lead.id)

        setStarredLeads(prev => {
          const next = new Set(prev)
          next.delete(lead.id)
          return next
        })
      } catch (error) {
        console.error('Error removing from watchlist:', error)
      }
    } else {
      // Add to watchlist
      const success = await addLeadToWatchlist(lead)
      if (success) {
        setStarredLeads(prev => new Set(prev).add(lead.id))
      }
    }
  }

  // Get unique event types
  const eventTypes = useMemo(() => {
    const types = new Set(
      leads
        .map((l) => (l as unknown as { latestSignal?: { type?: string } }).latestSignal?.type)
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    )
    return Array.from(types).sort()
  }, [leads])

  // Filter and sort leads based on view mode
  const filteredLeads = useMemo(() => {
    // Starter users: only the first 3 unlocked/saved leads are visible at all.
    // This is a hard visibility cap (no blur), aligned with Starter pitch/lead limits.
    let filtered = !isPro
      ? [...leads]
          .sort((a, b) => {
            const aMs = Date.parse(a.created_at || '') || 0
            const bMs = Date.parse(b.created_at || '') || 0
            if (aMs !== bMs) return aMs - bMs // oldest first
            return a.company_name.localeCompare(b.company_name)
          })
          .slice(0, STARTER_MAX_LEADS)
      : leads

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        lead =>
          lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.trigger_event.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lead.ai_personalized_pitch.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Event type filter
    if (selectedEventType) {
      filtered = filtered.filter((lead) => {
        const latestType = (lead as unknown as { latestSignal?: { type?: string } }).latestSignal?.type
        return latestType === selectedEventType
      })
    }

    if (minFitScore > 0) {
      filtered = filtered.filter((lead) => {
        const parsed = parseLeadFitSummary(lead.ai_personalized_pitch)
        const score = typeof lead.fit_score === 'number' ? lead.fit_score : parsed.score ?? 0
        return score >= minFitScore
      })
    }

    // Industry filter (placeholder - would use actual industry field)
    // For now, skip industry filter

    // Sort based on view mode (placeholder: both modes keep same dataset; just deterministic ordering).
    filtered = [...filtered].sort((a, b) => {
      const aMs = Date.parse(a.created_at || '') || 0
      const bMs = Date.parse(b.created_at || '') || 0
      if (bMs !== aMs) return bMs - aMs
      return a.company_name.localeCompare(b.company_name)
    })

    return filtered
  }, [leads, searchQuery, selectedEventType, isPro, minFitScore])

  const handleCopyPitch = async (pitch: string, leadId: string) => {
    try {
      const withAttribution = `${pitch}\n\nGenerated with RaelInfo`
      await navigator.clipboard.writeText(withAttribution)
      setCopiedId(leadId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    setIsDeletingLeadId(leadId)
    try {
      const response = await fetch('/api/leads/discover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      if (!response.ok) {
        throw new Error('delete_failed')
      }
      await refresh()
    } catch {
      // Intentionally fail-soft in UI; list is still refreshable.
    } finally {
      setIsDeletingLeadId(null)
    }
  }

  const exportLeads = () => {
    const csv = [
      ['Company', 'Domain', 'URL', 'Contact Email', 'Fit Score', 'Fit Explanation', 'Latest Signal', 'Created At', 'Attribution'].join(','),
      ...filteredLeads.map((lead) => {
        const parsed = parseLeadFitSummary(lead.ai_personalized_pitch ?? '')
        const fitScore = typeof lead.fit_score === 'number' ? String(lead.fit_score) : parsed.score !== null ? String(parsed.score) : ''
        const fitExplanation = parsed.explanation
        return [
          `"${lead.company_name}"`,
          `"${lead.company_domain || ''}"`,
          `"${lead.company_url || ''}"`,
          `"${lead.prospect_email || ''}"`,
          `"${fitScore}"`,
          `"${fitExplanation.replace(/"/g, '""')}"`,
          `"${((lead as unknown as { latestSignal?: { type?: string; detectedAt?: string } }).latestSignal?.type ?? '')}"`,
          `"${lead.created_at}"`,
          '"Generated with RaelInfo"',
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const starterUsage = useMemo(() => {
    // Canonical Starter usage model is derived from the number of distinct leads unlocked/saved.
    // We clamp to avoid negative credits or counts above the cap in the UI.
    return computeStarterLeadUsage(leads.length, STARTER_MAX_LEADS)
  }, [leads.length])

  const showStarterLimitNudge = useMemo(() => {
    if (isPro) return false
    if (leads.length < STARTER_MAX_LEADS) return false
    return true
  }, [isPro, leads.length])

  const selectedSavedSearch = useMemo(
    () => savedSearches.find((row) => row.id === selectedSavedSearchId) ?? null,
    [savedSearches, selectedSavedSearchId]
  )

  const savedSearchPreset = useMemo(() => {
    if (!selectedSavedSearch || !selectedSavedSearch.query_payload) return null
    const payload = selectedSavedSearch.query_payload
    return {
      targetIndustry: payload.targetIndustry ?? '',
      location: payload.location ?? '',
      companySize: payload.companySize ?? '',
      targetRole: payload.targetRole ?? '',
      painPoint: payload.painPoint ?? '',
      offerService: payload.offerService ?? '',
      numberOfLeads: typeof payload.numberOfLeads === 'number' ? payload.numberOfLeads : 10,
      savedSearchId: selectedSavedSearch.id,
    }
  }, [selectedSavedSearch])

  const handleSaveCurrentSearch = useCallback(
    async (result: LeadGenerationResponse) => {
      const payload = result.savedSearch
      if (payload) {
        await loadSavedSearches()
        return
      }
      if (!savedSearchName.trim()) return
      if (!draftSearchPayload) return

      setIsSavingSearch(true)
      try {
        const response = await fetch('/api/saved-searches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: savedSearchName.trim(),
            queryPayload: draftSearchPayload,
          }),
        })
        if (response.ok) {
          setSavedSearchName('')
          await loadSavedSearches()
        }
      } finally {
        setIsSavingSearch(false)
      }
    },
    [draftSearchPayload, loadSavedSearches, savedSearchName]
  )

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-cyan">LEAD LIBRARY</CardTitle>
            <CardDescription className="text-xs uppercase tracking-wider mt-1">
              {isPro ? (
                <>
                  {filteredLeads.length} of {leads.length} leads
                </>
              ) : (
                <>
                  {starterUsage.leadsUsed} of {starterUsage.maxLeads} leads • {starterUsage.creditsRemaining} credits
                  {' '}
                  remaining
                </>
              )}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={exportLeads}
            className="neon-border hover:glow-effect"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {showStarterLimitNudge ? (
          <StarterLimitNudge />
        ) : null}

        <div className="rounded border border-cyan-500/20 bg-background/30 p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-wide text-cyan-300">Retention loop guidance</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Step 1: Find leads</Badge>
              <Badge variant="outline">Step 2: Generate outreach</Badge>
              <Badge variant="outline">Step 3: Add to campaign</Badge>
              <Badge variant="outline">Step 4: Track progress</Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Leads refresh daily. New opportunities available when you rerun saved searches.
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
            <div className="text-xs text-foreground">Invite a friend &rarr; get more leads</div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs"
              onClick={() => {
                track('upgrade_clicked', { source: 'lead_library_referral_hook' })
                window.location.href = '/settings/team'
              }}
            >
              Invite a friend
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              New leads since last visit: {activitySummary?.newLeadsSinceLastVisit ?? 0}
            </Badge>
            <Badge variant="outline">
              Campaigns awaiting action: {activitySummary?.campaignsAwaitingAction ?? 0}
            </Badge>
          </div>
        </div>

        <div className="rounded border border-cyan-500/20 bg-background/30 p-3 space-y-3">
          <div className="text-xs uppercase tracking-wide text-cyan-300">Saved searches</div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              placeholder="Name this search (e.g. Fintech RevOps ICP)"
              value={savedSearchName}
              onChange={(event) => setSavedSearchName(event.target.value)}
              className="md:max-w-sm"
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedSavedSearchId ?? ''}
              onChange={(event) => setSelectedSavedSearchId(event.target.value || null)}
            >
              <option value="">No saved search selected</option>
              {savedSearches.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedSavedSearch}
              onClick={() => {
                if (!selectedSavedSearch) return
                setSelectedSavedSearchId(selectedSavedSearch.id)
                setRunAgainSignal((prev) => prev + 1)
                const panel = document.querySelector('[data-lead-generation-workflow="true"]')
                if (panel instanceof HTMLElement) {
                  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              Run Again
            </Button>
          </div>
          {selectedSavedSearch?.last_run_at ? (
            <div className="text-xs text-muted-foreground">
              Last run: {formatDate(selectedSavedSearch.last_run_at)}
            </div>
          ) : null}
        </div>

        <div data-lead-generation-workflow="true">
          <LeadGenerationWorkflow
            onGenerated={async () => {
              await refresh()
              await loadSavedSearches()
              await loadActivitySummary()
              await stampLeadLibraryVisit()
            }}
            preset={savedSearchPreset}
            defaultSavedSearchId={selectedSavedSearchId}
            modeLabel={selectedSavedSearch ? `Run Again: ${selectedSavedSearch.name}` : 'Lead Generation Workflow'}
            runSignal={runAgainSignal}
            onPayloadChange={(payload) => {
              setDraftSearchPayload({
                targetIndustry: payload.targetIndustry,
                location: payload.location,
                companySize: payload.companySize,
                targetRole: payload.targetRole,
                painPoint: payload.painPoint,
                offerService: payload.offerService,
                numberOfLeads: payload.numberOfLeads,
              })
            }}
            onResult={(result) => {
              void handleSaveCurrentSearch(result)
            }}
          />
        </div>
        {isSavingSearch ? (
          <div className="text-xs text-muted-foreground">Saving search preset…</div>
        ) : null}

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies, events, or pitches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bloomberg-font"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase">Filters:</span>
            </div>
            
            {/* Event Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={selectedEventType === null ? "default" : "outline"}
                onClick={() => setSelectedEventType(null)}
                className="h-7 text-xs"
              >
                All Events
              </Button>
              {eventTypes.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedEventType === type ? "default" : "outline"}
                  onClick={() => setSelectedEventType(type)}
                  className="h-7 text-xs"
                >
                  {type}
                </Button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {[0, 60, 80].map((score) => (
                <Button
                  key={`fit-${score}`}
                  size="sm"
                  variant={minFitScore === score ? 'default' : 'outline'}
                  onClick={() => setMinFitScore(score)}
                  className="h-7 text-xs"
                >
                  {score === 0 ? 'All Fits' : `Fit ${score}+`}
                </Button>
              ))}
            </div>

            {/* Clear Filters */}
            {(selectedEventType || minFitScore > 0) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedEventType(null)
                  setMinFitScore(0)
                }}
                className="h-7 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading leads...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <p className="text-muted-foreground mb-2">{COPY.errors.requestFailed.title}</p>
            <p className="text-xs text-muted-foreground">{COPY.errors.requestFailed.body}</p>
            <div className="mt-4">
              <Button size="sm" variant="outline" className="neon-border hover:glow-effect" onClick={() => void refresh()}>
                {COPY.errors.requestFailed.primary}
              </Button>
            </div>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {leads.length === 0 ? (
              <>
                <p className="text-muted-foreground">{COPY.states.empty.noSavedOutputs.title}</p>
                <p className="text-xs text-muted-foreground mt-2">{COPY.states.empty.noSavedOutputs.body}</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="sm"
                    className="neon-border hover:glow-effect"
                    onClick={() => (window.location.href = '/dashboard')}
                  >
                    {COPY.states.empty.noSavedOutputs.primary}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => (window.location.href = '/dashboard')}>
                    {COPY.states.empty.noSavedOutputs.secondary}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">{COPY.states.empty.noResults.title}</p>
                <p className="text-xs text-muted-foreground mt-2">{COPY.states.empty.noResults.body}</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="sm"
                    className="neon-border hover:glow-effect"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedEventType(null)
                      setMinFitScore(0)
                    }}
                  >
                    {COPY.states.empty.noResults.primary}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => (window.location.href = '/dashboard')}>
                    {COPY.states.empty.noResults.secondary}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bloomberg-font text-sm">
              <thead>
                <tr className="border-b border-cyan-500/20">
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Company</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Fit</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Why Fit</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Latest Signal</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, index) => {
                  // Starter: visually gate rows beyond the starter lead cap.
                  // Pro: show everything.
                  const shouldBlur = !isPro && index >= starterUsage.maxLeads
                  const highlightClass =
                    viewMode === 'startup'
                      ? 'border-l-2 border-l-green-500/10'
                      : 'border-l-2 border-l-blue-500/10'
                  const fitSummary = parseLeadFitSummary(lead.ai_personalized_pitch ?? '')
                  const fitScore = typeof lead.fit_score === 'number' ? lead.fit_score : fitSummary.score
                  
                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-cyan-500/10 hover:bg-background/30 transition-colors ${
                        shouldBlur ? 'opacity-50' : ''
                      } ${highlightClass}`}
                    >
                      <td className="py-3 px-4">
                        <div className={shouldBlur ? 'blur-sm' : ''}>
                          <div className="font-bold text-cyan-400">{lead.company_name}</div>
                          {lead.company_domain ? (
                            <div className="text-xs text-muted-foreground">{lead.company_domain}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            (fitScore ?? 0) >= 80
                              ? 'border-green-500/30 text-green-300 bg-green-500/10'
                              : (fitScore ?? 0) >= 60
                                ? 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10'
                                : 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                          }`}
                        >
                          {fitScore !== null && fitScore !== undefined ? `${fitScore}/100` : 'n/a'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className={`text-xs text-muted-foreground line-clamp-2 ${shouldBlur ? 'blur-sm' : ''}`}>
                          {fitSummary.explanation || 'Fit explanation unavailable.'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`text-xs ${shouldBlur ? 'blur-sm' : ''}`}>
                          {(lead as unknown as { latestSignal?: { type?: string; detectedAt?: string } }).latestSignal ? (
                            <span className="text-muted-foreground">
                              Latest signal:{' '}
                              {formatSignalType(
                                (lead as unknown as { latestSignal?: { type?: string } }).latestSignal?.type ?? ''
                              )}{' '}
                              ·{' '}
                              <span
                                title={new Date(
                                  (lead as unknown as { latestSignal?: { detectedAt?: string } }).latestSignal?.detectedAt ??
                                    ''
                                ).toLocaleString()}
                              >
                                {formatRelativeDate(
                                  (lead as unknown as { latestSignal?: { detectedAt?: string } }).latestSignal?.detectedAt ??
                                    ''
                                )}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {formatDate(lead.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                          {isPro && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleStar(lead)}
                              className={`h-7 text-xs whitespace-nowrap ${
                                starredLeads.has(lead.id)
                                  ? 'text-yellow-400 hover:bg-yellow-500/10'
                                  : 'hover:bg-cyan-500/10'
                              }`}
                              disabled={shouldBlur}
                            >
                              <Star className={`h-3 w-3 ${starredLeads.has(lead.id) ? 'fill-yellow-400' : ''}`} />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLead(lead)}
                            className="h-7 text-xs hover:bg-cyan-500/10 whitespace-nowrap"
                            disabled={shouldBlur}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyPitch(lead.ai_personalized_pitch, lead.id)}
                            className="h-7 text-xs hover:bg-cyan-500/10 whitespace-nowrap"
                            disabled={shouldBlur}
                          >
                            {copiedId === lead.id ? (
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDeleteLead(lead.id)}
                            className="h-7 text-xs hover:bg-red-500/10 text-red-400 whitespace-nowrap"
                            disabled={shouldBlur || isDeletingLeadId === lead.id}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {isDeletingLeadId === lead.id ? 'Deleting' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {selectedLead && (
        <LeadDetailView
          lead={selectedLead}
          isPro={isPro}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </Card>
  )
}

function StarterLimitNudge() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const can = shouldShowUpgradeNudge({ key: 'upgrade_accounts_limit', minHoursBetween: 24 })
    if (!can) return
    setVisible(true)
    track('upgrade_nudge_viewed', { location: 'lead_library', reason: 'starter_accounts_limit' })
    markUpgradeNudgeShown({ key: 'upgrade_accounts_limit' })
    void fetch('/api/settings/stamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_upgrade_nudge_shown_at: new Date().toISOString(), onboarding_completed: true }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once
  }, [])

  if (!visible) return null

  return (
    <div className="mt-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{COPY.gates.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{COPY.gates.body}</div>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
            {COPY.gates.benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setVisible(false)
            track('upgrade_nudge_dismissed', { location: 'lead_library' })
          }}
        >
          Not now
        </button>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          className="neon-border hover:glow-effect"
          onClick={() => {
            track('upgrade_nudge_clicked', { location: 'lead_library' })
            window.location.href = '/pricing?target=closer'
          }}
        >
          {COPY.gates.ctaPrimary}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            track('upgrade_nudge_clicked', { location: 'lead_library', secondary: true })
            window.location.href = '/pricing'
          }}
        >
          {COPY.gates.ctaSecondary}
        </Button>
      </div>
    </div>
  )
}
