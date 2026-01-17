'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, Loader2, MessageCircle, Sparkles } from "lucide-react"

interface SocialWarmerProps {
  companyName: string
  triggerEvent: string
  linkedinProfile?: string
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
}

export function SocialWarmer({ 
  companyName, 
  triggerEvent, 
  linkedinProfile,
  userSettings 
}: SocialWarmerProps) {
  const [comment, setComment] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateComment = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/generate-linkedin-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          triggerEvent,
          userSettings,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate comment')
      }

      const data = await response.json()
      setComment(data.comment)
    } catch (error) {
      console.error('Error generating comment:', error)
      // Fallback comment
      setComment(`Congratulations on ${triggerEvent}! Exciting times ahead for ${companyName}. 🚀`)
    } finally {
      setLoading(false)
    }
  }, [companyName, triggerEvent, userSettings])

  useEffect(() => {
    // Auto-generate on mount
    if (triggerEvent) {
      generateComment()
    }
  }, [triggerEvent, generateComment])

  const handleCopy = async () => {
    if (comment) {
      try {
        await navigator.clipboard.writeText(comment)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy:', error)
      }
    }
  }

  return (
    <Card className="border-purple-500/20 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg bloomberg-font">SOCIAL WARMER</CardTitle>
          </div>
          <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
            LinkedIn Ready
          </Badge>
        </div>
        <CardDescription className="text-xs uppercase tracking-wider">
          AI-Generated Comment for Rapport Building
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Crafting personalized comment...</p>
          </div>
        ) : comment ? (
          <div className="space-y-4">
            <div className="bg-background/50 border border-purple-500/10 rounded-md p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                {comment}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="flex-1 neon-border hover:glow-effect whitespace-nowrap min-w-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Comment
                  </>
                )}
              </Button>
              {linkedinProfile && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(linkedinProfile, '_blank')}
                  className="neon-border hover:glow-effect"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Open LinkedIn
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={generateComment}
                className="hover:bg-background/50"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              💡 Post this comment on their recent activity to warm up the relationship before sending your pitch email.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <Button
              size="sm"
              variant="outline"
              onClick={generateComment}
              className="neon-border hover:glow-effect"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Comment
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
