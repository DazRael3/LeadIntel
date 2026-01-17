'use client'

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/utils"
import { 
  Search, 
  Filter, 
  Building2, 
  Mail, 
  Linkedin, 
  Copy, 
  Check,
  X,
  Download,
  Eye,
  Star
} from "lucide-react"
import { EmailShield } from "@/components/EmailShield"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"
import { LeadDetailView } from "@/components/LeadDetailView"
import { addLeadToWatchlist } from "@/components/Watchlist"

interface LeadLibraryProps {
  isPro: boolean
  creditsRemaining: number
  viewMode?: 'startup' | 'enterprise'
}

export function LeadLibrary({ isPro, creditsRemaining, viewMode = 'startup' }: LeadLibraryProps) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
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
        setStarredLeads(new Set(data.map(item => item.lead_id)))
      }
    } catch (error) {
      console.error('Error loading starred leads:', error)
    }
  }, [isPro, supabase])

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

  const loadAllLeads = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error loading leads:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Get unique event types and industries
  const eventTypes = useMemo(() => {
    const types = new Set(leads.map(l => l.trigger_event))
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

    // Sort based on view mode
    if (viewMode === 'startup') {
      // Sort by Growth Potential (descending), then by fit_score
      filtered = [...filtered].sort((a, b) => {
        const aScore = a.growth_potential || 0
        const bScore = b.growth_potential || 0
        if (bScore !== aScore) return bScore - aScore
        return (b.fit_score || 0) - (a.fit_score || 0)
      })
    } else {
      // Sort by Enterprise Stability (descending), then by fit_score
      filtered = [...filtered].sort((a, b) => {
        const aScore = a.enterprise_stability || 0
        const bScore = b.enterprise_stability || 0
        if (bScore !== aScore) return bScore - aScore
        return (b.fit_score || 0) - (a.fit_score || 0)
      })
    }

    // Note: We don't filter out leads for free users
    // Instead, we blur them in the UI after their credit limit
    return filtered
  }, [leads, searchQuery, selectedEventType, viewMode])

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
      ['Company', 'Event Type', 'Email', 'LinkedIn', 'Created At'].join(','),
      ...filteredLeads.map(lead =>
        [
          `"${lead.company_name}"`,
          `"${lead.trigger_event}"`,
          `"${lead.prospect_email || ''}"`,
          `"${lead.prospect_linkedin || ''}"`,
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
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No leads found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bloomberg-font text-sm">
              <thead>
                <tr className="border-b border-cyan-500/20">
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Company</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Event</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">
                    {viewMode === 'startup' ? 'Growth Potential' : 'Enterprise Stability'}
                  </th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Fit Score</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Contact</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-cyan-400 uppercase text-xs tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, index) => {
                  // Free users: blur leads after their daily credit (1 lead)
                  // Pro users: see everything
                  const shouldBlur = !isPro && index >= creditsRemaining
                  
                  // Get the relevant score based on view mode
                  const primaryScore = viewMode === 'startup' 
                    ? (lead.growth_potential || 0)
                    : (lead.enterprise_stability || 0)
                  
                  // Highlight high-scoring leads
                  const isHighScore = primaryScore >= 70
                  const highlightClass = isHighScore 
                    ? viewMode === 'startup'
                      ? 'bg-green-500/5 border-l-2 border-l-green-500/30'
                      : 'bg-blue-500/5 border-l-2 border-l-blue-500/30'
                    : ''
                  
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
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs"
                        >
                          {lead.trigger_event}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`font-bold ${
                            primaryScore >= 80
                              ? viewMode === 'startup'
                                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                : 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                              : primaryScore >= 60
                              ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                              : 'border-red-500/30 text-red-400 bg-red-500/10'
                          }`}
                        >
                          {primaryScore}/100
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {lead.fit_score !== undefined ? (
                          <Badge
                            variant="outline"
                            className={`font-bold text-xs ${
                              lead.fit_score >= 80
                                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                : lead.fit_score >= 60
                                ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                                : 'border-red-500/30 text-red-400 bg-red-500/10'
                            }`}
                          >
                            {lead.fit_score}/100
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {lead.prospect_email && (
                            <div className={`relative flex items-center gap-1 group ${shouldBlur || !isPro ? 'blur-sm' : ''}`}>
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {isPro ? lead.prospect_email : '***@***.com'}
                              </span>
                              {isPro && !shouldBlur && <EmailShield email={lead.prospect_email} className="ml-1" />}
                              {(!isPro || shouldBlur) && (
                                <div className="absolute -inset-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                  <UpgradeOverlay />
                                </div>
                              )}
                            </div>
                          )}
                          {lead.prospect_linkedin && (
                            <div className="relative flex items-center gap-1 group">
                              <Linkedin className="h-3 w-3 text-muted-foreground" />
                              <a
                                href={isPro && !shouldBlur ? lead.prospect_linkedin : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs ${shouldBlur || !isPro ? 'blur-sm pointer-events-none' : 'hover:text-cyan-400'}`}
                                onClick={(e) => (!isPro || shouldBlur) && e.preventDefault()}
                              >
                                LinkedIn
                              </a>
                              {(!isPro || shouldBlur) && (
                                <div className="absolute -inset-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                  <UpgradeOverlay />
                                </div>
                              )}
                            </div>
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
