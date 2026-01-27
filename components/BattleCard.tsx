'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Shield, TrendingDown, Zap, Sparkles, Lock } from "lucide-react"
import { UpgradeOverlay } from "@/components/UpgradeOverlay"
import { useRouter } from "next/navigation"
import OpenAI from 'openai'
import { formatErrorMessage } from "@/lib/utils/format-error"

interface BattleCardProps {
  companyName: string
  companyUrl?: string
  triggerEvent: string
  leadId: string
  isPro?: boolean
}

interface BattleCardData {
  techStack: string[]
  weakness: string
  whyBetter: string
}

export function BattleCard({ companyName, companyUrl, triggerEvent, leadId, isPro = false }: BattleCardProps) {
  const [loading, setLoading] = useState(false)
  const [battleCard, setBattleCard] = useState<BattleCardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const generateBattleCard = useCallback(async () => {
    // Prevent generation for free users
    if (!isPro) {
      setError('Pro subscription required for Battle Card generation')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-battle-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          companyUrl: companyUrl || `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          triggerEvent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403) {
          throw new Error('Pro subscription required for Battle Card generation')
        }
        throw new Error(errorData.error || 'Failed to generate battle card')
      }

      const data = await response.json()
      setBattleCard(data)
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error generating battle card:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [isPro, companyName, companyUrl, triggerEvent])

  // Auto-generate on mount ONLY if Pro user and we have company URL
  useEffect(() => {
    if (isPro && companyUrl && !battleCard && !loading) {
      generateBattleCard()
    }
  }, [isPro, companyUrl, battleCard, loading, generateBattleCard])

  return (
    <Card className="border-purple-500/20 bg-card/50 relative group">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg bloomberg-font">BATTLE CARD</CardTitle>
          </div>
          {!isPro && (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Lock className="h-3 w-3 mr-1" />
              Pro Feature
            </Badge>
          )}
          {!battleCard && !loading && isPro && (
            <Button
              size="sm"
              variant="outline"
              onClick={generateBattleCard}
              className="neon-border hover:glow-effect"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          )}
        </div>
        <CardDescription className="text-xs uppercase tracking-wider">
          Competitive Intelligence for {companyName}
        </CardDescription>
      </CardHeader>
      <CardContent className={`relative overflow-hidden ${!isPro ? 'blur-sm pointer-events-none select-none' : ''}`}>
        {/* blurred brand backdrop */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]">
          <div className="absolute -inset-10 bg-[url('/branding/LeadIntel_DazRael.png')] bg-cover bg-center blur-2xl" />
        </div>

        {!isPro && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-sm rounded-lg border border-purple-500/30 p-4">
              <UpgradeOverlay />
            </div>
          </div>
        )}

        <div className="relative">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing competitive landscape...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400 mb-3">
                {typeof error === 'string' ? error : formatErrorMessage(error)}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generateBattleCard}
                className="neon-border"
              >
                Retry
              </Button>
            </div>
          ) : battleCard ? (
            <div className="space-y-4">
            {/* Tech Stack */}
            <div className="p-4 rounded-lg border border-cyan-500/10 bg-background/30">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-cyan-400" />
                <h4 className="font-bold text-sm uppercase tracking-wider text-cyan-400">
                  Current Tech Stack
                </h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {battleCard.techStack.map((tech, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Weakness */}
            <div className="p-4 rounded-lg border border-red-500/10 bg-background/30">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <h4 className="font-bold text-sm uppercase tracking-wider text-red-400">
                  Biggest Weakness
                </h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {battleCard.weakness}
              </p>
            </div>

            {/* Why Better */}
            <div className="p-4 rounded-lg border border-green-500/10 bg-background/30">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-green-400" />
                <h4 className="font-bold text-sm uppercase tracking-wider text-green-400">
                  Why Our Solution Wins
                </h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {battleCard.whyBetter}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              Click &quot;Generate&quot; to create a competitive battle card
            </p>
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
