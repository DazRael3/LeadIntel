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
import { Loader2, ArrowRight, ArrowLeft, Check, Zap, AlertTriangle } from "lucide-react"

interface OnboardingWizardProps {
  onComplete: () => void
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

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
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

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        // Try to get email and name from user
        setSenderEmail(user.email || '')
        setSenderName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')
      }
    })
  }, [supabase.auth])

  const handleIndustryToggle = (industry: string) => {
    setSelectedIndustries(prev =>
      prev.includes(industry)
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    )
  }

  const handleNext = () => {
    if (step === 1 && whatYouSell && idealCustomer) {
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
      // Save user settings via API route (ensures correct schema/RLS)
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: senderName || whatYouSell,
          from_email: senderEmail || '',
          from_name: senderName || whatYouSell,
          onboarding_completed: true,
        }),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        const errMsg = errJson.error || 'Failed to save settings'
        
        // Check if it's a migration required error (424 status)
        if (response.status === 424 && errJson.migration_required) {
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

      toast({
        variant: "success",
        title: "Setup Complete!",
        description: "Your settings have been saved successfully.",
      })
      
      onComplete()
    } catch (error: any) {
      console.error('Error saving settings:', error)
      const errorMsg = error.message || 'Failed to save settings. Please try again.'
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
    if (step === 1) return whatYouSell.trim() && idealCustomer.trim()
    if (step === 2) return selectedIndustries.length > 0
    if (step === 3) return senderName.trim() && senderEmail.trim()
    return false
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-cyan-500/30 bg-card/95">
        <CardHeader className="border-b border-cyan-500/20">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl bloomberg-font neon-cyan">
              5-MINUTE SETUP
            </CardTitle>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
              Step {step} of 3
            </Badge>
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

        <CardContent className="pt-6 space-y-6">
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

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-cyan-500/20">
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
        </CardContent>
      </Card>
    </div>
  )
}
