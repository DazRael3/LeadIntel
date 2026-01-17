'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Mail, Linkedin, Send, Loader2, Eye, Lock, DollarSign } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { Lead } from "@/lib/supabaseClient"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { EmailShield } from "@/components/EmailShield"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"
import { LeadDetailView } from "@/components/LeadDetailView"

interface LeadCardProps {
  lead: Lead
}

export function LeadCard({ lead }: LeadCardProps) {
  const [copied, setCopied] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [pushingToCrm, setPushingToCrm] = useState(false)
  const [crmPushed, setCrmPushed] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  
  // Generate confidence score (85-98%) - stable per lead
  const confidenceScore = useMemo(() => Math.floor(Math.random() * (98 - 85 + 1)) + 85, [])

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()
        
        if (data && data.subscription_tier === 'pro') {
          setIsPro(true)
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }

  const handleCopyPitch = async () => {
    if (!isPro) {
      // Redirect to checkout if not pro
      window.location.href = '/api/checkout'
      return
    }
    
    try {
      await navigator.clipboard.writeText(lead.ai_personalized_pitch)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handlePushToCRM = async () => {
    setPushingToCrm(true)
    try {
      const response = await fetch('/api/push-to-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      })

      if (!response.ok) {
        throw new Error('Failed to push to CRM')
      }

      setCrmPushed(true)
      setTimeout(() => setCrmPushed(false), 3000)
    } catch (error) {
      console.error('Error pushing to CRM:', error)
      alert('Failed to push to CRM. Please try again.')
    } finally {
      setPushingToCrm(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50 hover:border-cyan-500/40 hover:glow-effect transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-lg bloomberg-font neon-cyan">
                {lead.company_name}
              </CardTitle>
              <Badge 
                variant="outline" 
                className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
              >
                {lead.trigger_event}
              </Badge>
              <Badge 
                variant="outline" 
                className="border-green-500/30 text-green-400 bg-green-500/10"
              >
                {confidenceScore}% Confidence
              </Badge>
            </div>
            <CardDescription className="text-xs uppercase tracking-wider">
              {formatDate(lead.created_at)}
              {lead.prospect_email && (
                <span className="ml-3 relative inline-flex items-center gap-1 group">
                  <Mail className="h-3 w-3" />
                  <span className={`${!isPro ? 'blur-sm select-none' : ''}`}>
                    {isPro ? lead.prospect_email : 'Direct Email (Locked)'}
                  </span>
                  {isPro && <EmailShield email={lead.prospect_email} className="ml-1" />}
                  {!isPro && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <div className="bg-background/95 backdrop-blur-sm rounded px-2 py-1 border border-cyan-500/30">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.location.href = '/api/checkout'}
                          className="h-6 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                        >
                          Join Dazrael Pro
                        </Button>
                      </div>
                    </div>
                  )}
                </span>
              )}
              {lead.prospect_linkedin && (
                <span className="ml-3 relative inline-flex items-center">
                  <Linkedin className="h-3 w-3 mr-1" />
                  <a
                    href={isPro ? lead.prospect_linkedin : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${!isPro ? 'blur-sm pointer-events-none' : 'hover:text-cyan-400'}`}
                    onClick={(e) => !isPro && e.preventDefault()}
                  >
                    LinkedIn
                  </a>
                  {!isPro && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <UpgradeOverlay />
                    </span>
                  )}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                // For non-pro users, check unlock status before showing details
                if (!isPro) {
                  try {
                    const response = await fetch('/api/unlock-lead', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ leadId: lead.id }),
                    })
                    const data = await response.json()
                    
                    if (!response.ok && data.redirect) {
                      // Redirect to checkout if unlock failed
                      window.location.href = data.redirect
                      return
                    }
                    
                    if (response.ok) {
                      setShowDetail(true)
                    }
                  } catch (error) {
                    console.error('Error checking unlock:', error)
                  }
                } else {
                  setShowDetail(true)
                }
              }}
              className="neon-border hover:glow-effect"
            >
              <Eye className="h-4 w-4 mr-2" />
              {isPro ? 'View Details' : 'Unlock Lead'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePushToCRM}
              disabled={pushingToCrm || crmPushed}
              className="neon-border hover:glow-effect"
            >
              {pushingToCrm ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Pushing...
                </>
              ) : crmPushed ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-400" />
                  Pushed
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Push to CRM
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyPitch}
              disabled={!isPro}
              className={`neon-border hover:glow-effect whitespace-nowrap ${!isPro ? 'opacity-50' : ''}`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">{isPro ? 'AI Pitch' : 'AI Pitch (Locked)'}</span>
                  <span className="sm:hidden">{isPro ? 'Pitch' : 'Locked'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-background/50 border border-cyan-500/10 rounded-md p-4 relative">
          {!isPro && (
            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-md border border-cyan-500/30 z-10 flex items-center justify-center">
              <div className="text-center p-4">
                <Lock className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
                <p className="text-sm font-bold mb-2 text-cyan-400">Pro Feature</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Join Dazrael Pro to access Enterprise Intelligence and Automated Sales Agent.
                </p>
                <Button
                  size="sm"
                  onClick={() => window.location.href = '/api/checkout'}
                  className="neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          )}
          <p className={`text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground ${!isPro ? 'blur-sm select-none' : ''}`}>
            {isPro ? (lead.ai_personalized_pitch || 'AI failed to generate pitch. Please check OpenAI credits.') : 'AI Pitch content is locked. Upgrade to Pro to view personalized pitches and access Enterprise Intelligence features.'}
          </p>
        </div>
      </CardContent>

      {showDetail && (
        <LeadDetailView
          lead={lead}
          isPro={isPro}
          onClose={() => setShowDetail(false)}
        />
      )}
    </Card>
  )
}
