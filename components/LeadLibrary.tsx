'use client'

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/utils"
import { useLeadLibrary } from "@/app/dashboard/hooks/useLeadLibrary"
import { 
  Search, 
  Filter, 
  Building2, 
  Copy, 
  Check,
  X,
  Download,
  Eye,
  Star
} from "lucide-react"
import { LeadDetailView } from "@/components/LeadDetailView"
import { addLeadToWatchlist } from "@/components/Watchlist"

type WatchlistRow = {
  lead_id: string
}

interface LeadLibraryProps {
  isPro: boolean
  creditsRemaining: number
  viewMode?: 'startup' | 'enterprise'
}

export function LeadLibrary({ isPro, creditsRemaining, viewMode = 'startup' }: LeadLibraryProps) {
  const supabase = createClient()
  const { leads, isLoading: loading, error, refresh } = useLeadLibrary()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [starredLeads, setStarredLeads] = useState<Set<string>>(new Set())

  const loadStarredLeads = useCallback(async () => {
    if (!isPro) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleToggleStar = async (lead: Lead) => {
    if (!isPro) return

    const isStarred = starredLeads.has(lead.id)
    
    if (isStarred) {
      // Remove from watchlist
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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

  // Get unique event types and industries
  const eventTypes = useMemo(() => {
    const types = new Set(leads.map((l) => l.trigger_event).filter(Boolean))
    return Array.from(types).sort()
  }, [leads])

  const industries = useMemo(() => {
    // Extract industry from company name or use placeholder
    // In production, you'd have an industry field
    return ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail']
  }, [])

  // Filter and sort leads based on view mode
  const filteredLeads = useMemo(() => {
    let filtered = leads

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
      filtered = filtered.filter(lead => lead.trigger_event === selectedEventType)
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

    // Note: We don't filter out leads for free users
    // Instead, we blur them in the UI after their credit limit
    return filtered
  }, [leads, searchQuery, selectedEventType])

  const handleCopyPitch = async (pitch: string, leadId: string) => {
    try {
      await navigator.clipboard.writeText(pitch)
      setCopiedId(leadId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const exportLeads = () => {
    const csv = [
      ['Company', 'Domain', 'URL', 'Latest Signal', 'Created At'].join(','),
      ...filteredLeads.map(lead =>
        [
          `"${lead.company_name}"`,
          `"${lead.company_domain || ''}"`,
          `"${lead.company_url || ''}"`,
          `"${lead.trigger_event || ''}"`,
          `"${lead.created_at}"`
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-cyan">LEAD LIBRARY</CardTitle>
            <CardDescription className="text-xs uppercase tracking-wider mt-1">
              {filteredLeads.length} of {leads.length} leads
              {!isPro && ` • ${creditsRemaining} credits remaining`}
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

            {/* Clear Filters */}
            {(selectedEventType || selectedIndustry) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedEventType(null)
                  setSelectedIndustry(null)
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
            <p className="text-muted-foreground mb-2">We couldn’t load your leads right now.</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No leads yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Generate your first pitch in the Command Center to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bloomberg-font text-sm">
              <thead>
                <tr className="border-b border-cyan-500/20">
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Company</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Latest Signal</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, index) => {
                  // Free users: blur leads after their daily credit (1 lead)
                  // Pro users: see everything
                  const shouldBlur = !isPro && index >= creditsRemaining
                  const highlightClass =
                    viewMode === 'startup'
                      ? 'border-l-2 border-l-green-500/10'
                      : 'border-l-2 border-l-blue-500/10'
                  
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
                        <div className={`text-xs ${shouldBlur ? 'blur-sm' : ''}`}>
                          <span className="text-muted-foreground">{lead.trigger_event || '—'}</span>
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
