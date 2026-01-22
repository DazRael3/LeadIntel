'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import { Building2, Activity, Lock, Sparkles, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"

interface LiveIntentVisitor {
  id: string
  company_name?: string
  company_domain?: string
  company_industry?: string
  visited_at: string
  ip_address: string
}

interface LiveIntentProps {
  isPro: boolean
}

export function LiveIntent({ isPro }: LiveIntentProps) {
  const supabase = createClient()
  const [visitors, setVisitors] = useState<LiveIntentVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadVisitors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('website_visitors')
        .select('*')
        .order('visited_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setVisitors(data || [])
    } catch (error) {
      console.error('Error loading visitors:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isPro) {
      loadVisitors()
      
      // Set up real-time subscription
      const channel = supabase
        .channel('live-intent-channel')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'api', table: 'website_visitors' },
          () => {
            loadVisitors()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isPro, loadVisitors, supabase])

  const uniqueCompanies = new Set(visitors.filter(v => v.company_name).map(v => v.company_name))
  const recentVisitors = visitors.filter(v => {
    const visitTime = new Date(v.visited_at).getTime()
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    return visitTime > oneHourAgo
  })

  if (!isPro) {
    return (
      <Card className="border-purple-500/20 bg-card/50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500/20 to-transparent w-32 h-32 blur-3xl" />
        </div>
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-xl bloomberg-font neon-purple">LIVE INTENT</CardTitle>
            </div>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Lock className="h-3 w-3 mr-1" />
              Pro Only
            </Badge>
          </div>
          <CardDescription className="text-xs uppercase tracking-wider">
            Enterprise Intelligence • Ghost Reveal Technology
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-center py-12">
            <div className="mb-6">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-purple-400/50" />
              <h3 className="text-lg font-bold mb-2 text-purple-400">Enterprise Feature Locked</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Ghost Reveal identifies companies visiting your website in real-time. 
                See exactly which prospects are checking you out before they reach out.
              </p>
            </div>
            <Button
              onClick={() => router.push('/pricing')}
              className="neon-border hover:glow-effect bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-3 py-2 max-w-full whitespace-normal"
            >
              <Sparkles className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="text-center">Join Dazrael Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-purple-500/20 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-purple">LIVE INTENT</CardTitle>
            <CardDescription className="text-xs uppercase tracking-wider mt-1">
              {recentVisitors.length} active visitors • {uniqueCompanies.size} companies identified
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
              <Activity className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Sparkles className="h-3 w-3 mr-1" />
              Ghost Reveal
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading live intent data...</div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No visitors identified yet</p>
            <p className="text-xs text-muted-foreground">
              Embed the Ghost Reveal script on your website to start tracking visitors
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visitors.slice(0, 20).map((visitor) => (
              <div
                key={visitor.id}
                className="flex items-center justify-between p-3 rounded-lg border border-purple-500/10 bg-background/30 hover:bg-background/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {visitor.company_name ? (
                      <>
                        <Building2 className="h-4 w-4 text-purple-400" />
                        <span className="font-bold bloomberg-font text-purple-400">
                          {visitor.company_name}
                        </span>
                        {visitor.company_domain && (
                          <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs">
                            {visitor.company_domain}
                          </Badge>
                        )}
                        {new Date(visitor.visited_at).getTime() > Date.now() - (60 * 60 * 1000) && (
                          <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                            <Activity className="h-2 w-2 mr-1" />
                            Active
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Anonymous Visitor</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{visitor.ip_address}</span>
                    {visitor.company_industry && (
                      <span>• {visitor.company_industry}</span>
                    )}
                    <span>• {formatDate(visitor.visited_at)}</span>
                  </div>
                </div>
                {visitor.company_name && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const url = visitor.company_domain || visitor.company_name || ''
                      const name = visitor.company_name || ''
                      router.push(`/pitch?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`)
                    }}
                    className="hover:bg-purple-500/10 text-purple-400"
                  >
                    <TrendingUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
