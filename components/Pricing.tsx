'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Zap, Shield, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { usePlan } from "@/components/PlanProvider"
import { formatErrorMessage } from "@/lib/utils/format-error"

/**
 * Safely parses JSON, returning null if parsing fails
 */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Extracts a user-friendly error message from API error responses.
 * Handles the standardized error envelope: { ok: false, error: { code, message } }
 */
function extractApiErrorMessage(payload: unknown): string {
  // Handle null/undefined
  if (payload == null) {
    return 'An unknown error occurred'
  }
  
  // Handle string error
  if (typeof payload === 'string') {
    return payload.length > 200 ? `${payload.substring(0, 197)}...` : payload
  }
  
  // Handle our standardized error envelope: { ok: false, error: { code, message } }
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    
    // Check for error.message (our standard format)
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>
      if (typeof err.message === 'string') {
        return err.message
      }
    }
    
    // Check for direct message property
    if (typeof obj.message === 'string') {
      return obj.message
    }
    
    // Fallback to formatErrorMessage for other object shapes
    return formatErrorMessage(payload)
  }
  
  return 'An unexpected error occurred'
}

/**
 * Checks if an error message contains Stripe configuration hints
 */
function isStripeConfigError(message: string): boolean {
  if (typeof message !== 'string') return false
  const lowerMessage = message.toLowerCase()
  return lowerMessage.includes('stripe_price_id') || 
         lowerMessage.includes('price_') ||
         lowerMessage.includes('stripe configuration')
}

export function Pricing() {
  const router = useRouter()
  const supabase = createClient()
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const { isPro } = usePlan()

  useEffect(() => {
    if (isPro) {
      router.replace('/dashboard')
    }
  }, [isPro, router])

  const handleCheckout = async () => {
    setIsCheckoutLoading(true)
    setCheckoutError(null)
    
    try {
      // Check authentication before calling /api/checkout
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        // Not authenticated - redirect to login
        router.push('/login?mode=signin&redirect=/pricing')
        return
      }

      // User is authenticated - proceed with checkout
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'pro' }),
      })

      // Parse response safely: read as text, then JSON.parse if present.
      const raw = await response.text()
      const payload = raw.trim().length > 0 ? safeJsonParse(raw) : null

      // Handle error responses
      if (!response.ok) {
        // 401 -> redirect to login
        if (response.status === 401) {
          router.push('/login?mode=signin&redirect=/pricing')
          return
        }
        
        // 409 -> already subscribed
        if (response.status === 409) {
          router.replace('/dashboard')
          return
        }
        
        // Extract a meaningful error message.
        const errorMessage =
          extractApiErrorMessage(payload) ||
          (raw.trim().length > 0 ? raw : `Checkout failed (${response.status})`)
        console.error('[Pricing] Checkout failed:', { status: response.status, message: errorMessage })
        setCheckoutError(errorMessage)
        return
      }

      // Success response - extract URL and redirect
      const data = payload as { ok?: boolean; data?: { url?: string }; url?: string } | null
      
      // Handle standardized response: { ok: true, data: { url } }
      const checkoutUrl = data?.data?.url || data?.url
      
      if (checkoutUrl && typeof checkoutUrl === 'string') {
        window.location.href = checkoutUrl
      } else {
        console.error('[Pricing] No checkout URL in response:', data)
        setCheckoutError('Checkout failed: no redirect URL was returned')
      }
    } catch (error: unknown) {
      // Network error or other exception
      console.error('[Pricing] Checkout exception:', error)
      setCheckoutError(formatErrorMessage(error))
    } finally {
      setIsCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid py-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bloomberg-font neon-cyan mb-4">
            PRO PLAN
          </h1>
          <p className="text-muted-foreground text-lg">
            Unlock unlimited lead intelligence and AI-powered pitches
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="border-cyan-500/30 bg-card/80 glow-effect relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-500/20 to-transparent w-32 h-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 bg-gradient-to-r from-blue-500/20 to-transparent w-32 h-32 blur-3xl" />
            
            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl bloomberg-font">PRO</CardTitle>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  Most Popular
                </Badge>
              </div>
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-5xl font-bold neon-cyan">$99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <CardDescription className="mt-2">
                Everything you need to dominate B2B sales
              </CardDescription>
            </CardHeader>
            
            <CardContent className="relative z-10 space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Unlimited AI-Generated Leads</p>
                    <p className="text-sm text-muted-foreground">Real-time scraping and intelligence</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">GPT-4o Personalized Pitches</p>
                    <p className="text-sm text-muted-foreground">High-converting, company-specific pitches</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Priority Scraper Access</p>
                    <p className="text-sm text-muted-foreground">Faster processing and more sources</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Advanced Analytics</p>
                    <p className="text-sm text-muted-foreground">Conversion tracking and insights</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Email Contact Extraction</p>
                    <p className="text-sm text-muted-foreground">Automated lead enrichment</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-green-500/20 border border-green-500/30 mt-0.5">
                    <Check className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">API Access</p>
                    <p className="text-sm text-muted-foreground">Integrate with your CRM</p>
                  </div>
                </li>
              </ul>

              {checkoutError && (
                <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="font-medium text-sm">{checkoutError}</p>
                      {isStripeConfigError(checkoutError) && (
                        <div className="text-xs space-y-1">
                          <p className="text-red-300/80">
                            Fix STRIPE_PRICE_ID in .env.local by copying the Price ID from Stripe Products &gt; Pricing (starts with price_)
                          </p>
                          <p className="text-red-300/60 font-mono">
                            Example: STRIPE_PRICE_ID=price_xxxxxxxxxxxxx
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleCheckout}
                disabled={isCheckoutLoading}
                className="w-full h-12 text-lg font-bold neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                size="lg"
              >
                {isCheckoutLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Subscribe Now
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Cancel anytime. No hidden fees.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
              <h3 className="font-bold mb-2">Secure Payment</h3>
              <p className="text-sm text-muted-foreground">
                Powered by Stripe. Your data is encrypted and secure.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-green-400" />
              <h3 className="font-bold mb-2">Proven Results</h3>
              <p className="text-sm text-muted-foreground">
                Join hundreds of sales teams closing more deals.
              </p>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/10 bg-card/50 text-center">
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 mx-auto mb-3 text-purple-400" />
              <h3 className="font-bold mb-2">Instant Access</h3>
              <p className="text-sm text-muted-foreground">
                Get started immediately after subscription.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
