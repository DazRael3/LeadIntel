'use client'

import { useMemo, useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Send, Loader2, Lock, Mail, TrendingUp, BarChart3, Clock } from "lucide-react"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"
import { useRouter } from "next/navigation"
import { formatErrorMessage } from "@/lib/utils/format-error"

interface EmailSequenceProps {
  companyName: string
  triggerEvent: string
  ceoName?: string | null
  companyInfo?: string | null
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
  isPro: boolean
  recipientEmail?: string
}

interface SequenceData {
  part1: string // Helpful tone
  part2: string // Data-driven tone
  part3: string // Short/Final follow-up
}

export function EmailSequence({ 
  companyName, 
  triggerEvent, 
  ceoName, 
  companyInfo,
  userSettings,
  isPro,
  recipientEmail
}: EmailSequenceProps) {
  const siteUrl = useMemo(() => (process.env.NEXT_PUBLIC_SITE_URL || 'https://leadintel.com').trim(), [])
  const [sequence, setSequence] = useState<SequenceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [sending, setSending] = useState<number | null>(null)
  const [sent, setSent] = useState<number | null>(null)
  const router = useRouter()

  const generateSequence = useCallback(async () => {
    // Prevent generation for free users
    if (!isPro) {
      console.log('Email Sequence generation blocked for free user')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/generate-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          triggerEvent,
          ceoName,
          companyInfo,
          userSettings,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403) {
          throw new Error('Pro subscription required for Email Sequence generation')
        }
        throw new Error(errorData.error || 'Failed to generate sequence')
      }

      const data = await response.json()
      setSequence(data.sequence)
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error generating sequence:', errorMessage)
      // Don't set fallback sequence for free users - let them see the error/upgrade prompt
      if (typeof errorMessage === 'string' && errorMessage.includes('Pro subscription required')) {
        // Free user - don't generate fallback, UI will show upgrade overlay
        setSequence(null)
      } else {
        // For Pro users with other errors, show fallback
        if (isPro) {
          setSequence({
            part1: `Hi ${ceoName || 'there'}, I've created a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}. View it here: ${siteUrl}`,
            part2: `Based on your recent ${triggerEvent}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence. View your customized report: ${siteUrl}`,
            part3: `Final reminder: Your competitive intelligence report for ${companyName} is ready. View it here: ${siteUrl}`,
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }, [isPro, companyName, triggerEvent, ceoName, companyInfo, userSettings, siteUrl])

  // Only auto-generate if Pro user
  useEffect(() => {
    if (isPro && triggerEvent) {
      generateSequence()
    }
  }, [isPro, triggerEvent, generateSequence])

  const handleCopy = async (text: string, part: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(part)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleSend = async (text: string, part: number) => {
    if (!recipientEmail) {
      alert('No email address available for this lead')
      return
    }

    setSending(part)
    try {
      const response = await fetch('/api/send-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          recipientName: ceoName || companyName,
          companyName,
          pitch: text,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      setSent(part)
      setTimeout(() => setSent(null), 5000)
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error sending email:', errorMessage)
      alert(errorMessage)
    } finally {
      setSending(null)
    }
  }

  // Always render, but blur for free users

  return (
    <Card className="border-purple-500/20 bg-card/50 relative group">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg bloomberg-font">EMAIL SEQUENCER</CardTitle>
          </div>
          {!isPro ? (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Lock className="h-3 w-3 mr-1" />
              Pro Feature
            </Badge>
          ) : (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Clock className="h-3 w-3 mr-1" />
              3-Part Sequence
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs uppercase tracking-wider">
          Enterprise Intelligence • Automated Multi-Touch Outreach
        </CardDescription>
      </CardHeader>
      <CardContent className={`relative ${!isPro ? 'blur-sm pointer-events-none select-none' : ''}`}>
        {!isPro && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg border border-purple-500/30 p-4">
              <UpgradeOverlay />
            </div>
          </div>
        )}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Generating 3-part sequence...</p>
          </div>
        ) : sequence ? (
          <div className="space-y-6">
            {/* Part 1: Helpful */}
            <div className="p-4 rounded-lg border border-green-500/10 bg-background/30 relative group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-400" />
                  <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs">
                    Email 1 • Helpful Tone
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipientEmail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSend(sequence.part1, 1)}
                      disabled={sending === 1 || sent === 1}
                      className="h-7 text-xs hover:bg-green-500/10 whitespace-nowrap"
                    >
                      {sending === 1 ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : sent === 1 ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(sequence.part1, 1)}
                    className="h-7 text-xs hover:bg-green-500/10 whitespace-nowrap"
                  >
                    {copied === 1 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                {sequence.part1}
              </p>
            </div>

            {/* Part 2: Data-Driven */}
            <div className="p-4 rounded-lg border border-blue-500/10 bg-background/30 relative group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs">
                    Email 2 • Data-Driven
                  </Badge>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs">
                    Send in 3-5 days
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipientEmail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSend(sequence.part2, 2)}
                      disabled={sending === 2 || sent === 2}
                      className="h-7 text-xs hover:bg-blue-500/10 whitespace-nowrap"
                    >
                      {sending === 2 ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : sent === 2 ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(sequence.part2, 2)}
                    className="h-7 text-xs hover:bg-blue-500/10 whitespace-nowrap"
                  >
                    {copied === 2 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                {sequence.part2}
              </p>
            </div>

            {/* Part 3: Final Follow-up */}
            <div className="p-4 rounded-lg border border-orange-500/10 bg-background/30 relative group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <Badge variant="outline" className="border-orange-500/30 text-orange-400 bg-orange-500/10 text-xs">
                    Email 3 • Final Follow-up
                  </Badge>
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs">
                    Send in 7-10 days
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recipientEmail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSend(sequence.part3, 3)}
                      disabled={sending === 3 || sent === 3}
                      className="h-7 text-xs hover:bg-orange-500/10 whitespace-nowrap"
                    >
                      {sending === 3 ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : sent === 3 ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(sequence.part3, 3)}
                    className="h-7 text-xs hover:bg-orange-500/10 whitespace-nowrap"
                  >
                    {copied === 3 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                {sequence.part3}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              Click &quot;Generate&quot; to create a 3-part email sequence
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
