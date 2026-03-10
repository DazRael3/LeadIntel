'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/utils"
import { Building2, Globe, Activity, Copy, Check } from "lucide-react"
import { getAppBaseUrl } from "@/lib/app-url"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const loadVisitors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('website_visitors')
        .select('*')
        .order('visited_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setVisitors(data || [])
      setUnavailable(null)
    } catch (error) {
      const msg = (() => {
        if (typeof error !== 'object' || error === null) return ''
        if (!('message' in error)) return ''
        const m = (error as { message?: unknown }).message
        return typeof m === 'string' ? m : ''
      })()
      // Treat permission/config errors as an “unavailable” state, not a scary “broken” state.
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('not allowed') || msg.includes('42501')) {
        setUnavailable('Visitor tracking is not available for this workspace yet.')
      } else if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('schema')) {
        setUnavailable('Visitor tracking is not configured in this environment.')
      } else {
        setUnavailable('Visitor data is unavailable right now.')
      }
      setVisitors([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadVisitors()
    
    // Set up real-time subscription only after a successful initial load (avoids noisy auth/config errors).
    let channel: ReturnType<typeof supabase.channel> | null = null
    if (!unavailable) {
      channel = supabase
        .channel('visitors-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'api', table: 'website_visitors' }, () => {
          loadVisitors()
        })
        .subscribe()
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [loadVisitors, supabase, unavailable])

  const getTrackingScript = () => {
    const script = `<script src="${getAppBaseUrl()}/api/tracker"></script>`
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
        ) : unavailable ? (
          <div className="text-center py-12 space-y-3">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground" />
            <div className="text-muted-foreground">{unavailable}</div>
            <div className="text-xs text-muted-foreground">
              If you expected to see visitor data, confirm your plan and workspace setup, then try again.
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Button asChild variant="outline" className="neon-border hover:glow-effect">
                <Link href="/pricing">See plans</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/support">Contact support</Link>
              </Button>
            </div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-2">No visitors tracked yet</p>
            <p className="text-xs text-muted-foreground">
              Embed the tracking script on your website to start identifying visitors
            </p>
            <div className="mt-6 mx-auto max-w-xl text-left">
              <div className="text-xs font-semibold tracking-wide text-muted-foreground mb-2">How to set this up</div>
              <div className="rounded-lg border border-cyan-500/10 bg-background/30 p-4 space-y-2">
                <div className="text-xs text-muted-foreground">
                  1) Paste this script tag into your site (before <code>{'</body>'}</code>):
                </div>
                <pre className="text-[11px] overflow-auto rounded bg-background/60 border border-cyan-500/10 p-3">
{getTrackingScript()}
                </pre>
                <div className="text-[11px] text-muted-foreground">
                  In production this will use the live app URL, not localhost.
                </div>
                <div className="text-[11px] text-muted-foreground">
                  2) Load a page on your site, then come back here.
                </div>
              </div>
            </div>
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
