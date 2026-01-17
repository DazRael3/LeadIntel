'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Copy, Check, Mail, Shield, Zap, TrendingDown, Lock, BarChart3, Clock, DollarSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatErrorMessage } from "@/lib/utils/format-error"

interface PitchGeneratorProps {
  initialUrl?: string
}

interface BattleCard {
  currentTech: string[]
  painPoint: string
  killerFeature: string
}

interface EmailSequence {
  part1: string
  part2: string
  part3: string
}

export function PitchGenerator({ initialUrl = "" }: PitchGeneratorProps) {
  const [companyUrl, setCompanyUrl] = useState(initialUrl)
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pitch, setPitch] = useState<string | null>(null)
  const [emailSequence, setEmailSequence] = useState<EmailSequence | null>(null)
  const [battleCard, setBattleCard] = useState<BattleCard | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [savedCompanies, setSavedCompanies] = useState<string[]>([])
  const router = useRouter()
  const supabase = createClient()

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()
        
        if (data) {
          setIsPro(data.subscription_tier === 'pro')
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }, [supabase])

  useEffect(() => {
    if (initialUrl) {
      setCompanyUrl(initialUrl)
    }
    checkSubscription()
    loadSaved()
  }, [initialUrl, checkSubscription])

  const loadSaved = () => {
    try {
      const stored = localStorage.getItem('leadintel_saved_companies')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setSavedCompanies(parsed.slice(0, 10))
        }
      }
    } catch {
      // ignore
    }
  }

  const persistSaved = (url: string) => {
    try {
      const next = [url, ...savedCompanies.filter(u => u !== url)].slice(0, 10)
      setSavedCompanies(next)
      localStorage.setItem('leadintel_saved_companies', JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const handleGenerate = async () => {
    if (!companyUrl.trim()) return

    // Check authentication before calling API
    setAuthError(null)
    const { data: { user }, error: authCheckError } = await supabase.auth.getUser()
    
    if (authCheckError || !user) {
      setAuthError('Please sign in to generate intelligence.')
      router.push('/login?redirect=/')
      return
    }

    setLoading(true)
    setPitch(null)
    setEmailSequence(null)
    setBattleCard(null)
    setWarnings([])

    try {
      const response = await fetch('/api/generate-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyUrl }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          setAuthError('Please sign in to generate intelligence.')
          router.push('/login?redirect=/')
          return
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate pitch')
      }

      const data = await response.json() as {
        pitch?: string
        warnings?: string[]
        isPro?: boolean
        emailSequence?: EmailSequence
        battleCard?: BattleCard
        lead?: unknown
        triggerEvent?: unknown
      }
      
      // ALWAYS set pitch - this is the primary output (does NOT depend on lead/triggerEvent)
      if (data.pitch && typeof data.pitch === 'string') {
        setPitch(data.pitch)
        persistSaved(companyUrl)
      } else {
        // Fallback if pitch is missing
        setPitch('Pitch generation completed, but no pitch text was returned.')
      }

      // Parse warnings array defensively (non-blocking)
      setWarnings(Array.isArray(data.warnings) ? data.warnings : [])

      // Update isPro from response (if present)
      if (data.isPro !== undefined) {
        setIsPro(data.isPro)
      }

      // Set email sequence (3-part) - Enterprise Intelligence feature
      if (data.emailSequence) {
        setEmailSequence(data.emailSequence)
      }

      // Set battle card - Enterprise Intelligence feature
      if (data.battleCard) {
        setBattleCard(data.battleCard)
      }
    } catch (error: unknown) {
      const errorMessage = formatErrorMessage(error)
      console.error('Error generating pitch:', errorMessage)
      setAuthError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string, part: number) => {
    await navigator.clipboard.writeText(text)
    setCopied(part)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Main Pitch Generator Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <CardTitle>AI Pitch Generator</CardTitle>
            </div>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
              <Shield className="h-3 w-3 mr-1" />
              Enterprise Intel
            </Badge>
          </div>
          <CardDescription>
            Enter a company URL to generate a personalized 3-part email sequence and battle card
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {authError && (
            <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              {authError}
            </div>
          )}
          {(warnings?.length ?? 0) > 0 && (
            <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
              <p className="font-medium mb-1">Database persistence warning:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {warnings.map((warning: string, idx: number) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
              <p className="text-xs mt-2 text-muted-foreground">
                Pitch generated successfully, but some data may not have been saved. Check Supabase schema configuration.
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              className="flex-1"
            />
            <Button onClick={handleGenerate} disabled={loading || !companyUrl.trim()}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        {savedCompanies.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Saved companies:</span>
            {savedCompanies.map((u) => (
              <Button
                key={u}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setCompanyUrl(u)}
              >
                {u}
              </Button>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {/* Generated Pitch Display */}
      {pitch && (
        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <CardTitle className="text-lg">Generated Pitch</CardTitle>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(pitch, 0)}
                className="h-7 text-xs"
              >
                {copied === 0 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                Copy Pitch
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg border border-cyan-500/10 bg-background/30">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {pitch}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Sequence - 3-Part Sequencer */}
      {loading ? (
        <Card className="border-purple-500/20 bg-card/50">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Generating 3-part email sequence...</p>
          </CardContent>
        </Card>
      ) : emailSequence ? (
        <Card className="border-purple-500/20 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg bloomberg-font">EMAIL SEQUENCER</CardTitle>
              </div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                <Shield className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            </div>
            <CardDescription className="text-xs uppercase tracking-wider">
              Enterprise Intelligence • 3-Part Automated Sequence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Part 1: Helpful */}
              <div className="p-4 rounded-lg border border-green-500/10 bg-background/30">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="h-4 w-4 text-green-400" />
                    <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10 text-xs whitespace-nowrap">
                      Email 1 • Helpful Tone
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(emailSequence.part1, 1)}
                    className="h-7 text-xs hover:bg-green-500/10 whitespace-nowrap"
                  >
                    {copied === 1 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                  {emailSequence.part1}
                </p>
              </div>

              {/* Part 2: Data-Driven */}
              <div className="p-4 rounded-lg border border-blue-500/10 bg-background/30">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-xs whitespace-nowrap">
                      Email 2 • Data-Driven
                    </Badge>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs whitespace-nowrap">
                      Send in 3-5 days
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(emailSequence.part2, 2)}
                    className="h-7 text-xs hover:bg-blue-500/10 whitespace-nowrap"
                  >
                    {copied === 2 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                  {emailSequence.part2}
                </p>
              </div>

              {/* Part 3: Final Follow-up */}
              <div className="p-4 rounded-lg border border-orange-500/10 bg-background/30">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="h-4 w-4 text-orange-400" />
                    <Badge variant="outline" className="border-orange-500/30 text-orange-400 bg-orange-500/10 text-xs whitespace-nowrap">
                      Email 3 • Final Follow-up
                    </Badge>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-xs whitespace-nowrap">
                      Send in 7-10 days
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(emailSequence.part3, 3)}
                    className="h-7 text-xs hover:bg-orange-500/10 whitespace-nowrap"
                  >
                    {copied === 3 ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
                  {emailSequence.part3}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !isPro ? (
        <Card className="border-purple-500/20 bg-card/50 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500/20 to-transparent w-32 h-32 blur-3xl" />
          </div>
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg bloomberg-font neon-purple">EMAIL SEQUENCER</CardTitle>
              </div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                <Lock className="h-3 w-3 mr-1" />
                Pro Only
              </Badge>
            </div>
            <CardDescription className="text-xs uppercase tracking-wider">
              Enterprise Intelligence • 3-Part Automated Sequence
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-center py-12">
              <div className="mb-6">
                <Mail className="h-16 w-16 mx-auto mb-4 text-purple-400/50" />
                <h3 className="text-lg font-bold mb-2 text-purple-400">Enterprise Feature Locked</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Automate your outreach with a 3-part email sequence: Helpful opener, data-driven follow-up, and final reminder. 
                  Each email is AI-optimized for maximum engagement.
                </p>
              </div>
              <Button
                onClick={() => router.push('/pricing')}
                className="neon-border hover:glow-effect bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-3 py-2 max-w-full whitespace-normal"
              >
                <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="text-center">Join Dazrael Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Battle Card */}
      {loading ? (
        <Card className="border-purple-500/20 bg-card/50">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-3 text-purple-400 animate-spin" />
            <p className="text-sm text-muted-foreground">Generating battle card...</p>
          </CardContent>
        </Card>
      ) : battleCard ? (
        <Card className="border-purple-500/20 bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg bloomberg-font">BATTLE CARD</CardTitle>
              </div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                <Shield className="h-3 w-3 mr-1" />
                Pro
              </Badge>
            </div>
            <CardDescription className="text-xs uppercase tracking-wider">
              Enterprise Intelligence • 3-Point Competitive Intelligence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Current Tech */}
              <div className="p-4 rounded-lg border border-cyan-500/10 bg-background/30">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <h4 className="font-bold text-sm uppercase tracking-wider text-cyan-400">
                    1. Likely Current Tech
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {battleCard.currentTech.map((tech, idx) => (
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

              {/* Pain Point */}
              <div className="p-4 rounded-lg border border-red-500/10 bg-background/30">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <h4 className="font-bold text-sm uppercase tracking-wider text-red-400">
                    2. Pain Point
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {battleCard.painPoint}
                </p>
              </div>

              {/* Killer Feature */}
              <div className="p-4 rounded-lg border border-green-500/10 bg-background/30">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-green-400" />
                  <h4 className="font-bold text-sm uppercase tracking-wider text-green-400">
                    3. Killer Feature
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {battleCard.killerFeature}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !isPro ? (
        <Card className="border-purple-500/20 bg-card/50 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500/20 to-transparent w-32 h-32 blur-3xl" />
          </div>
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg bloomberg-font neon-purple">BATTLE CARD</CardTitle>
              </div>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                <Lock className="h-3 w-3 mr-1" />
                Pro Only
              </Badge>
            </div>
            <CardDescription className="text-xs uppercase tracking-wider">
              Enterprise Intelligence • 3-Point Competitive Intelligence
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-center py-12">
              <div className="mb-6">
                <Shield className="h-16 w-16 mx-auto mb-4 text-purple-400/50" />
                <h3 className="text-lg font-bold mb-2 text-purple-400">Enterprise Feature Locked</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Get instant competitive intelligence: Current tech stack, pain points, and your killer feature that solves their challenge.
                </p>
              </div>
              <Button
                onClick={() => router.push('/pricing')}
                className="neon-border hover:glow-effect bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-3 py-2 max-w-full whitespace-normal"
              >
                <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="text-center">Join Dazrael Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
