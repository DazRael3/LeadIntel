'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Copy, Check, Mail, Shield, Zap, TrendingDown, Lock, BarChart3, Clock, DollarSign, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { formatErrorMessage } from "@/lib/utils/format-error"
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

interface PitchGeneratorProps {
  initialUrl?: string
  onCompanyContextChange?: (args: { companyInput: string; companyDomain: string | null }) => void
  onSavedCompaniesChange?: (companies: string[]) => void
}

type ApiSuccess<T> = { ok: true; data: T }
type ApiError = { ok: false; error: { code?: string; message?: string } }
type ApiEnvelope<T> = ApiSuccess<T> | ApiError

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

type GeneratePitchPayload = {
  pitch?: unknown
  warnings?: unknown
  isPro?: unknown
  emailSequence?: unknown
  battleCard?: unknown
  lead?: unknown
  triggerEvent?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrapGeneratePitchPayload(raw: unknown): GeneratePitchPayload {
  // Canonical API shape is the standardized envelope: { ok: true, data: {...} }
  if (isRecord(raw) && raw.ok === true && 'data' in raw) {
    const data = (raw as ApiSuccess<unknown>).data
    return isRecord(data) ? (data as GeneratePitchPayload) : {}
  }
  // Backward/legacy: some callers may expect a flat object already containing fields.
  return isRecord(raw) ? (raw as GeneratePitchPayload) : {}
}

function getSavedKey(userId: string | null): string {
  return `leadintel_saved_companies_${userId || 'anon'}`
}

function normalizeSaved(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const v of value) {
    if (typeof v !== 'string') continue
    const s = v.trim()
    if (!s) continue
    if (!out.includes(s)) out.push(s)
    if (out.length >= 25) break
  }
  return out
}

export function PitchGenerator({ initialUrl = "", onCompanyContextChange, onSavedCompaniesChange }: PitchGeneratorProps) {
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Initialize user id once so per-user keys work on first render.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        setCurrentUserId(user?.id ?? null)
      } catch {
        if (!cancelled) setCurrentUserId(null)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [supabase])

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

  const loadSaved = useCallback(
    async (userIdOverride?: string | null) => {
      const userId = userIdOverride ?? currentUserId
      try {
        // Always hydrate from the user-scoped localStorage key first (fast UI).
        const stored = localStorage.getItem(getSavedKey(userId))
        const localParsed = stored ? normalizeSaved(JSON.parse(stored)) : []
        if (localParsed.length > 0) {
          setSavedCompanies(localParsed)
        } else if (!userId) {
          setSavedCompanies([])
        }
      } catch {
        if (!userId) setSavedCompanies([])
      }

      // If signed in, prefer Supabase (per-user persistence).
      if (!userId) return

      try {
        const { data: settingsRow, error } = await supabase
          .from('user_settings')
          .select('saved_companies')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          return
        }

        const dbList = normalizeSaved((settingsRow as { saved_companies?: unknown } | null)?.saved_companies)

        // Optional one-time merge: carry over anon list into the user list if present.
        let anonList: string[] = []
        try {
          const anonStored = localStorage.getItem(getSavedKey(null))
          anonList = anonStored ? normalizeSaved(JSON.parse(anonStored)) : []
        } catch {
          anonList = []
        }

        const merged = normalizeSaved([...dbList, ...anonList])
        setSavedCompanies(merged)
        localStorage.setItem(getSavedKey(userId), JSON.stringify(merged))

        if (anonList.length > 0) {
          // Persist merged list back to DB and clear anon key to avoid cross-account bleed.
          await supabase.from('user_settings').upsert({ user_id: userId, saved_companies: merged })
          localStorage.removeItem(getSavedKey(null))
        }
      } catch {
        // Ignore; local fallback already applied.
      }
    },
    [currentUserId, supabase]
  )

  useEffect(() => {
    onSavedCompaniesChange?.(savedCompanies)
  }, [savedCompanies, onSavedCompaniesChange])

  const extractDomainFromInput = useCallback((value: string): string | null => {
    const raw = value.trim()
    if (!raw) return null
    try {
      const url = raw.startsWith('http') ? new URL(raw) : new URL('https://' + raw)
      return url.hostname.replace(/^www\./, '')
    } catch {
      const cleaned = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
      return cleaned.includes('.') ? cleaned : null
    }
  }, [])

  useEffect(() => {
    if (initialUrl) {
      setCompanyUrl(initialUrl)
    }
    checkSubscription()
    void loadSaved()
    // Keep saved companies scoped to the current authenticated user.
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const nextUserId = session?.user?.id ?? null
      setCurrentUserId(nextUserId)
      void loadSaved(nextUserId)
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [initialUrl, checkSubscription, loadSaved, supabase.auth])

  const persistSaved = async (url: string) => {
    const userId = currentUserId
    const next = [url, ...savedCompanies.filter((u) => u !== url)].slice(0, 25)
    setSavedCompanies(next)
    try {
      localStorage.setItem(getSavedKey(userId), JSON.stringify(next))
    } catch {
      // ignore
    }

    // Persist per-user when authenticated.
    if (!userId) return
    try {
      await supabase.from('user_settings').upsert({ user_id: userId, saved_companies: next })
    } catch {
      // ignore
    }
  }

  const removeSaved = useCallback(
    async (company: string) => {
      const userId = currentUserId
      const next = savedCompanies.filter((c) => c !== company)
      setSavedCompanies(next)
      try {
        localStorage.setItem(getSavedKey(userId), JSON.stringify(next))
      } catch {
        // ignore
      }
      if (!userId) return
      try {
        await supabase.from('user_settings').upsert({ user_id: userId, saved_companies: next })
      } catch {
        // ignore
      }
    },
    [currentUserId, savedCompanies, supabase]
  )

  const selectCompany = useCallback(
    (company: string) => {
      setCompanyUrl(company)
      onCompanyContextChange?.({ companyInput: company, companyDomain: extractDomainFromInput(company) })
    },
    [extractDomainFromInput, onCompanyContextChange]
  )

  const handleGenerate = async () => {
    const trimmedInput = companyUrl.trim()
    
    // Local validation
    if (!trimmedInput) {
      setAuthError('Please enter a company name, URL, or topic for your pitch.')
      return
    }
    
    if (trimmedInput.length > 1000) {
      setAuthError('Input is too long (max 1000 characters).')
      return
    }

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
        const errorData = await response.json().catch(() => null)
        // Extract error message from various response formats
        let errorMessage = 'Failed to generate pitch. Please try again.'
        if (errorData) {
          // Handle { error: { message } } format
          if (typeof errorData.error?.message === 'string') {
            errorMessage = errorData.error.message
          // Handle { error: string } format
          } else if (typeof errorData.error === 'string') {
            errorMessage = errorData.error
          // Handle { message: string } format
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message
          }
        }
        throw new Error(errorMessage)
      }

      const raw = (await response.json()) as unknown
      const data = unwrapGeneratePitchPayload(raw)
      
      // ALWAYS set pitch - this is the primary output (does NOT depend on lead/triggerEvent)
      const pitchText = typeof data.pitch === 'string' ? data.pitch.trim() : ''
      if (pitchText) {
        setPitch(pitchText)
        await persistSaved(companyUrl)
        onCompanyContextChange?.({
          companyInput: companyUrl,
          companyDomain: extractDomainFromInput(companyUrl),
        })
      } else {
        // Only show this fallback when the request succeeded but the canonical pitch field is empty.
        setPitch('Pitch generation completed, but no pitch text was returned.')
      }

      // Parse warnings array defensively (non-blocking)
      setWarnings(Array.isArray(data.warnings) ? (data.warnings as string[]) : [])

      // Update isPro from response (if present)
      if (typeof data.isPro === 'boolean') {
        setIsPro(data.isPro)
      }

      // Set email sequence (3-part) - Enterprise Intelligence feature
      if (isRecord(data.emailSequence)) {
        const seq = data.emailSequence as Record<string, unknown>
        if (typeof seq.part1 === 'string' && typeof seq.part2 === 'string' && typeof seq.part3 === 'string') {
          setEmailSequence({ part1: seq.part1, part2: seq.part2, part3: seq.part3 })
        }
      }

      // Set battle card - Enterprise Intelligence feature
      if (isRecord(data.battleCard)) {
        const bc = data.battleCard as Record<string, unknown>
        if (Array.isArray(bc.currentTech) && typeof bc.painPoint === 'string' && typeof bc.killerFeature === 'string') {
          setBattleCard({
            currentTech: bc.currentTech.filter((t) => typeof t === 'string') as string[],
            painPoint: bc.painPoint,
            killerFeature: bc.killerFeature,
          })
        }
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
            Enter a company name, URL, or topic to generate a personalized 3-part email sequence and battle card
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
              placeholder="e.g., lego.com, SaaS analytics tool, webinar for HR leaders"
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Saved companies:</span>
            {savedCompanies.map((u) => (
              <div key={u} className="inline-flex items-center rounded-md border bg-background">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => selectCompany(u)}
                  title={`Use ${u}`}
                >
                  {u}
                </Button>
                <button
                  type="button"
                  className="h-7 w-7 grid place-items-center border-l text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  aria-label={`Remove ${u}`}
                  onClick={() => void removeSaved(u)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
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
                <span className="text-center">Join LeadIntel Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
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
                <span className="text-center">Join LeadIntel Pro to access Enterprise Intelligence and Automated Sales Agent.</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
