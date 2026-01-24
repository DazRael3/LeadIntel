'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import type { Lead, WatchlistItem } from "@/lib/supabaseClient"
import { formatDate } from "@/lib/utils"
import { Star, Building2, TrendingUp, AlertCircle, X } from "lucide-react"
import { LeadDetailView } from "@/components/LeadDetailView"

interface WatchlistProps {
  isPro: boolean
}

export function Watchlist({ isPro }: WatchlistProps) {
  const supabase = createClient()
  const [watchlistItems, setWatchlistItems] = useState<(WatchlistItem & { lead: Lead })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const loadWatchlist = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('watchlist')
        .select(`
          *,
          lead:leads(*)
        `)
        .eq('user_id', user.id)
        .order('watched_at', { ascending: false })

      if (error) throw error

      // Filter out expired items and transform data
      const now = new Date()
      const validItems = (data || [])
        .filter((item: any) => new Date(item.expires_at) > now)
        .map((item: any) => ({
          ...item,
          lead: item.lead as Lead
        }))

      setWatchlistItems(validItems)
    } catch (error) {
      console.error('Error loading watchlist:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isPro) {
      loadWatchlist()
      
      // Set up real-time subscription (using api schema to match database)
      const channel = supabase
        .channel('watchlist-channel')
        .on('postgres_changes', 
          { event: '*', schema: 'api', table: 'watchlist' },
          () => {
            loadWatchlist()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isPro, loadWatchlist, supabase])

  const removeFromWatchlist = async (leadId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('lead_id', leadId)

      if (error) throw error
      
      loadWatchlist()
    } catch (error) {
      console.error('Error removing from watchlist:', error)
    }
  }

  const addToWatchlist = async (lead: Lead) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

      const { error } = await supabase
        .from('watchlist')
        .insert({
          user_id: user.id,
          lead_id: lead.id,
          expires_at: expiresAt.toISOString(),
        })

      if (error) {
        // Might already exist, try updating instead
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('watchlist')
            .update({
              watched_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
            })
            .eq('user_id', user.id)
            .eq('lead_id', lead.id)

          if (updateError) throw updateError
        } else {
          throw error
        }
      }
      
      loadWatchlist()
    } catch (error) {
      console.error('Error adding to watchlist:', error)
    }
  }

  if (!isPro) {
    return (
      <Card className="border-purple-500/20 bg-card/50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500/20 to-transparent w-32 h-32 blur-3xl" />
        </div>
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-lg bloomberg-font neon-purple">WATCHLIST</CardTitle>
            </div>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              Pro Only
            </Badge>
          </div>
          <CardDescription className="text-xs uppercase tracking-wider">
            Personalized Retention • 30-Day Strategic Monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-center py-12">
            <Star className="h-16 w-16 mx-auto mb-4 text-purple-400/50" />
            <h3 className="text-lg font-bold mb-2 text-purple-400">Enterprise Feature Locked</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Star leads to automatically monitor them for 30 days. Get strategic updates when new hires, stock changes, or other trigger events occur.
            </p>
            <Button
              onClick={() => (window.location.href = '/pricing')}
              className="neon-border hover:glow-effect bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-3 py-2 max-w-full whitespace-normal"
            >
              <span className="text-center">Join LeadIntel Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="border-purple-500/20 bg-card/50">
        <CardContent className="py-12 text-center">
          <div className="animate-pulse text-muted-foreground">Loading watchlist...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-purple-500/20 bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-400 fill-purple-400" />
              <CardTitle className="text-lg bloomberg-font">WATCHLIST</CardTitle>
            </div>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              {watchlistItems.length} Monitored
            </Badge>
          </div>
          <CardDescription className="text-xs uppercase tracking-wider">
            Personalized Retention • 30-Day Strategic Monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watchlistItems.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No leads in watchlist</p>
              <p className="text-xs text-muted-foreground">
                Star leads from the Lead Library to monitor them for strategic updates
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlistItems.map((item) => {
                const daysRemaining = Math.ceil(
                  (new Date(item.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                )
                
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-purple-500/10 bg-background/30 hover:bg-background/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Building2 className="h-4 w-4 text-purple-400" />
                          <span className="font-bold text-purple-400">{item.lead.company_name}</span>
                          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs">
                            {item.lead.trigger_event}
                          </Badge>
                          {item.lead.growth_potential !== undefined && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Growth: {item.lead.growth_potential}/100
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Watched: {formatDate(item.watched_at)}</span>
                          <span>•</span>
                          <span className={daysRemaining < 7 ? 'text-orange-400' : ''}>
                            {daysRemaining} days remaining
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLead(item.lead)}
                          className="hover:bg-purple-500/10 text-purple-400"
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromWatchlist(item.lead.id)}
                          className="hover:bg-red-500/10 text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLead && (
        <LeadDetailView
          lead={selectedLead}
          isPro={isPro}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </>
  )
}

// Export function to add lead to watchlist (used by LeadCard/LeadLibrary)
export async function addLeadToWatchlist(lead: Lead): Promise<boolean> {
  const supabase = createClient()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const { error } = await supabase
      .from('watchlist')
      .insert({
        user_id: user.id,
        lead_id: lead.id,
        expires_at: expiresAt.toISOString(),
      })

    if (error) {
      if (error.code === '23505') {
        // Already exists, update it
        const { error: updateError } = await supabase
          .from('watchlist')
          .update({
            watched_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq('user_id', user.id)
          .eq('lead_id', lead.id)

        return !updateError
      }
      return false
    }

    return true
  } catch (error) {
    console.error('Error adding to watchlist:', error)
    return false
  }
}
