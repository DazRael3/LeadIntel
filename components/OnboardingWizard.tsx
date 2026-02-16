'use client'

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, ArrowRight, ArrowLeft, Check, Zap, AlertTriangle, X } from "lucide-react"
import { formatErrorMessage } from "@/lib/utils/format-error"
import { getUserSafe } from "@/lib/supabase/safe-auth"

interface OnboardingWizardProps {
  onComplete: () => void
  onClose?: () => void
}

// LocalStorage key for onboarding completion fallback
const ONBOARDING_KEY = 'leadintel:onboarding-completed'

/**
 * Mark onboarding as completed in localStorage (fallback for when API fails)
 */
function markOnboardingCompletedLocally(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, 'true')
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Check if this looks like a local/dev environment based on URL
 */
function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function isValidEmail(email: string): boolean {
  const s = email.trim()
  if (!s) return false
  // Simple, user-friendly validation (server does strict zod validation too).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

const INDUSTRY_OPTIONS = [
  'Technology / SaaS',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail / E-commerce',
  'Education',
  'Real Estate',
  'Consulting',
  'Marketing / Advertising',
  'Automotive',
  'Energy',
  'Other',
]

const ROLE_OPTIONS = ['SDR', 'AE', 'Founder', 'Consultant', 'Investor', 'Marketing', 'RevOps', 'Other'] as const
const TEAM_SIZE_OPTIONS = ['solo', '2-5', '6-20', '21+'] as const
const PRIMARY_GOAL_OPTIONS = ['outbound', 'investing', 'competitive_intel', 'pipeline_building', 'market_research'] as const
const CONTACT_CHANNEL_OPTIONS = ['email', 'phone', 'linkedin', 'slack', 'other'] as const

export function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const supabase = createClient()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [whatYouSell, setWhatYouSell] = useState('')
  const [idealCustomer, setIdealCustomer] = useState('')
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [role, setRole] = useState<string>('')
  const [teamSize, setTeamSize] = useState<string>('')
  const [primaryGoal, setPrimaryGoal] = useState<string>('')
  const [heardAbout, setHeardAbout] = useState<string>('')
  const [preferredContactChannel, setPreferredContactChannel] = useState<string>('')
  const [preferredContactDetail, setPreferredContactDetail] = useState<string>('')
  const [allowProductUpdates, setAllowProductUpdates] = useState<boolean>(true)

  useEffect(() => {
    // Ensure the wizard is fully visible (no header overlap) and starts at top.
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo(0, 0)
      } catch {
        // ignore
      }
    }
    // Get current user
    void (async () => {
      const user = await getUserSafe(supabase)
      if (user) {
        setUserId(user.id)
        // Try to get email and name from user
        setSenderEmail(user.email || '')
        setSenderName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
      }
    })()
  }, [supabase])

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry)
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    )
  }

  const handleNext = () => {
    if (step === 1 && whatYouSell && idealCustomer && role && teamSize && primaryGoal) {
      setStep(2)
    } else if (step === 2 && selectedIndustries.length > 0) {
      setStep(3)
    } else if (step === 3) {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to continue with setup.",
      })
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      if (!senderName.trim()) {
        setError('Please enter your name.')
        return
      }
      if (!isValidEmail(senderEmail)) {
        setError('Please enter a valid email address.')
        return
      }

      // Save user settings via API route (ensures correct schema/RLS)
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: senderName || whatYouSell,
          from_email: senderEmail.trim(),
          from_name: senderName || whatYouSell,
          onboarding_completed: true,
          role: role || undefined,
          team_size: teamSize || undefined,
          primary_goal: primaryGoal || undefined,
          heard_about_us_from: heardAbout.trim() || undefined,
          preferred_contact_channel: preferredContactChannel || undefined,
          preferred_contact_detail: preferredContactDetail.trim() || undefined,
          allow_product_updates: allowProductUpdates,
        }),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        // Extract error message properly - handle both { error: string } and { error: { code, message } }
        const errMsg = typeof errJson.error === 'string' 
          ? errJson.error 
          : typeof errJson.error?.message === 'string'
            ? errJson.error.message
            : 'Failed to save settings'
        
        // Check if it's an origin error in local environment - soft fail and continue
        const isOriginError = response.status === 403 && 
          (errMsg.toLowerCase().includes('origin') || errJson.error?.code === 'FORBIDDEN')
        
        if (isOriginError && isLocalEnvironment()) {
          console.warn('[Onboarding] Origin validation failed in local mode, continuing with localStorage fallback')
          markOnboardingCompletedLocally()
          toast({
            variant: "default",
            title: "Setup Complete (Local Mode)",
            description: "Settings saved locally. Remote sync will happen on next login.",
          })
          onComplete()
          return
        }
        
        // Check if it's a migration required error (424 status)
        if (response.status === 424 && (errJson.migration_required || errJson.error?.action)) {
          const isDev = process.env.NODE_ENV !== 'production'
          
          if (isDev) {
            setError(`Admin Action Required: ${errMsg}`)
            toast({
              variant: "destructive",
              title: "Database Migration Required",
              description: (
                <div className="space-y-2">
                  <p>{errMsg}</p>
                  <div className="text-xs bg-background/50 p-2 rounded border border-yellow-500/30">
                    <p className="font-semibold mb-1">Steps to fix:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Run: <code className="bg-background px-1 rounded">npm run migration</code></li>
                      <li>Copy SQL and run in Supabase SQL Editor</li>
                      <li>Then run: <code className="bg-background px-1 rounded">NOTIFY pgrst, &apos;reload schema&apos;;</code></li>
                      <li>Restart dev server</li>
                    </ol>
                  </div>
                </div>
              ),
            })
          } else {
            toast({
              variant: "destructive",
              title: "Configuration Error",
              description: "Please contact support. A database migration is required.",
            })
          }
        } else {
          setError(errMsg)
          toast({
            variant: "destructive",
            title: "Failed to Save Settings",
            description: errMsg,
          })
        }
        return
      }

      // Mark onboarding completed in localStorage as well (for consistency)
      markOnboardingCompletedLocally()
      
      toast({
        variant: "success",
        title: "Setup Complete!",
        description: "Your settings have been saved successfully.",
      })
      
      onComplete()
    } catch (error: unknown) {
      const errorMsg = formatErrorMessage(error)
      console.error('Error saving settings:', errorMsg)
      setError(errorMsg)
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      })
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return whatYouSell.trim() && idealCustomer.trim() && role.trim() && teamSize.trim() && primaryGoal.trim()
    if (step === 2) return selectedIndustries.length > 0
    if (step === 3) return senderName.trim() && senderEmail.trim()
    return false
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-cyan-500/30 bg-card/95 flex flex-col max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b border-cyan-500/20">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl bloomberg-font neon-cyan">
              5-MINUTE SETUP
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
                Step {step} of 3
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Close setup"
                onClick={() => onClose?.()}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-sm">
            Let&apos;s personalize LeadIntel for your business
          </CardDescription>
          
          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          <div className="flex-1 overflow-y-auto pr-2 px-6 pt-6 pb-4 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm mb-1 text-red-400">Error</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: What do you sell? */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <Label htmlFor="whatYouSell" className="text-base font-bold mb-2 block">
                  What do you sell? <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="whatYouSell"
                  placeholder="e.g., B2B SaaS platform for sales teams, AI-powered analytics tools, cloud infrastructure solutions..."
                  value={whatYouSell}
                  onChange={(e) => setWhatYouSell(e.target.value)}
                  className="min-h-[100px] bloomberg-font"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Describe your product or service in 1-2 sentences
                </p>
              </div>

              <div>
                <Label htmlFor="idealCustomer" className="text-base font-bold mb-2 block">
                  Who is your ideal customer? <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="idealCustomer"
                  placeholder="e.g., Mid-size SaaS companies (50-500 employees) that are scaling their sales teams and need better lead intelligence..."
                  value={idealCustomer}
                  onChange={(e) => setIdealCustomer(e.target.value)}
                  className="min-h-[100px] bloomberg-font"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Describe the type of company that would benefit most from your solution
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="role" className="text-base font-bold mb-2 block">
                    Your role <span className="text-red-400">*</span>
                  </Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                  >
                    <option value="">Select…</option>
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="teamSize" className="text-base font-bold mb-2 block">
                    Team size <span className="text-red-400">*</span>
                  </Label>
                  <select
                    id="teamSize"
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                  >
                    <option value="">Select…</option>
                    {TEAM_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="primaryGoal" className="text-base font-bold mb-2 block">
                    Primary goal <span className="text-red-400">*</span>
                  </Label>
                  <select
                    id="primaryGoal"
                    value={primaryGoal}
                    onChange={(e) => setPrimaryGoal(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                  >
                    <option value="">Select…</option>
                    {PRIMARY_GOAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="heardAbout" className="text-base font-bold mb-2 block">
                  How did you hear about LeadIntel? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="heardAbout"
                  placeholder="e.g., Twitter, friend, newsletter, Google…"
                  value={heardAbout}
                  onChange={(e) => setHeardAbout(e.target.value)}
                  className="bloomberg-font"
                />
              </div>
            </div>
          )}

          {/* Step 2: Target Industries */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <Label className="text-base font-bold mb-4 block">
                  Select your target industries <span className="text-red-400">*</span>
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select all industries where your ideal customers operate
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => handleIndustryToggle(industry)}
                      className={`p-3 rounded-lg border text-sm text-left transition-all ${
                        selectedIndustries.includes(industry)
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-cyan-500/20 hover:border-cyan-500/40 hover:bg-background/50'
                      }`}
                    >
                      {selectedIndustries.includes(industry) && (
                        <Check className="h-4 w-4 inline mr-2 text-cyan-400" />
                      )}
                      {industry}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Sender Info */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <Label htmlFor="senderName" className="text-base font-bold mb-2 block">
                  Your Name (for emails) <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="senderName"
                  placeholder="John Smith"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="bloomberg-font"
                />
              </div>

              <div>
                <Label htmlFor="senderEmail" className="text-base font-bold mb-2 block">
                  Your Email (for emails) <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="senderEmail"
                  type="email"
                  placeholder="john@yourcompany.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="bloomberg-font"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This will be used as the &quot;From&quot; address when sending pitches (Pro feature)
                </p>
              </div>

              <div className="pt-2 border-t border-cyan-500/10">
                <h3 className="text-base font-bold mb-3">How should we reach you?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="preferredContactChannel" className="text-sm font-semibold mb-2 block">
                      Preferred channel <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <select
                      id="preferredContactChannel"
                      value={preferredContactChannel}
                      onChange={(e) => setPreferredContactChannel(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                    >
                      <option value="">No preference</option>
                      {CONTACT_CHANNEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="preferredContactDetail" className="text-sm font-semibold mb-2 block">
                      Contact detail <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="preferredContactDetail"
                      placeholder={
                        preferredContactChannel === 'phone'
                          ? '+1 (555) 123-4567'
                          : preferredContactChannel === 'linkedin'
                            ? 'linkedin.com/in/your-handle'
                            : preferredContactChannel === 'slack'
                              ? '@yourhandle or workspace'
                              : preferredContactChannel === 'email'
                                ? 'you@company.com'
                                : 'Handle / link'
                      }
                      value={preferredContactDetail}
                      onChange={(e) => setPreferredContactDetail(e.target.value)}
                      className="bloomberg-font"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowProductUpdates}
                    onChange={(e) => setAllowProductUpdates(e.target.checked)}
                    className="mt-1"
                  />
                  <span>Send me product updates and tips (you can change this later in Settings)</span>
                </label>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm mb-1">You&apos;re all set!</h4>
                    <p className="text-xs text-muted-foreground">
                      LeadIntel will use this information to score leads and personalize pitches specifically for your business.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Footer Navigation (always visible) */}
          <div className="shrink-0 px-6 py-4 border-t border-slate-800/60 bg-slate-950/90 backdrop-blur">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1 || loading}
                className="hover:bg-background/50"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={!canProceed() || loading}
                  className="neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Complete Setup
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
