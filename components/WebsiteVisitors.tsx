'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import { Building2, Globe, Activity, Copy, Check } from "lucide-react"

interface WebsiteVisitor {
  id: string
  ip_address: string
  company_name?: string
  company_domain?: string
  company_industry?: string
  visited_at: string
  referer?: string
}

export function WebsiteVisitors() {
  const supabase = createClient()
  const [visitors, setVisitors] = useState<WebsiteVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedScript, setCopiedScript] = useState(false)

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
    loadVisitors()
    
    // Set up real-time subscription
    const channel = supabase
      .channel('visitors-channel')
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
  }, [loadVisitors, supabase])

  const getTrackingScript = () => {
    const script = `<script src="${window.location.origin}/api/tracker"></script>`
    return script
  }

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(getTrackingScript())
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const uniqueCompanies = new Set(visitors.filter(v => v.company_name).map(v => v.company_name))

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-xl bloomberg-font neon-cyan">WEBSITE VISITORS</CardTitle>
            <CardDescription className="text-xs uppercase tracking-wider mt-1">
              {visitors.length} visitors • {uniqueCompanies.size} companies identified
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
              <Activity className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
            <button
              onClick={handleCopyScript}
              className="px-3 py-1.5 text-xs border border-cyan-500/30 rounded hover:bg-cyan-500/10 text-cyan-400 flex items-center gap-2"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy Script
                </>
              )}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading visitors...</div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No visitors tracked yet</p>
            <p className="text-xs text-muted-foreground">
              Embed the tracking script on your website to start identifying visitors
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/10 bg-background/30 hover:bg-background/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {visitor.company_name ? (
                      <>
                        <Building2 className="h-4 w-4 text-cyan-400" />
                        <span className="font-bold bloomberg-font text-cyan-400">
                          {visitor.company_name}
                        </span>
                        {visitor.company_domain && (
                          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs">
                            {visitor.company_domain}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 text-muted-foreground" />
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
