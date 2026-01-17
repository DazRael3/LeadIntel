import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import { getPlan } from '@/lib/billing/plan'
import { PlanProvider } from '@/components/PlanProvider'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/dashboard')
  }

  // Safe defaults
  let subscriptionTier: 'free' | 'pro' = 'free'
  let creditsRemaining = 1
  let onboardingCompleted = false

  // Try to get subscription tier from billing module
  try {
    subscriptionTier = await getPlan(supabase as Parameters<typeof getPlan>[0], user.id)
  } catch (err) {
    console.warn('[Dashboard] Error getting plan, defaulting to free:', err)
    subscriptionTier = 'free'
  }

  // Try to get user data (may fail if columns don't exist)
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier, credits_remaining, last_credit_reset')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      // Check if it's a column-not-found error
      const errorStr = String(userError.message || '')
      if (errorStr.includes('does not exist') || errorStr.includes('column')) {
        console.warn('[Dashboard] Schema mismatch on users table, using defaults')
      } else {
        console.error('[Dashboard] Error loading user data:', userError)
      }
    } else if (userData) {
      // Use subscription_tier from users table if available
      if (userData.subscription_tier) {
        subscriptionTier = userData.subscription_tier as 'free' | 'pro'
      }
      
      // Calculate credits for free users
      if (subscriptionTier === 'free') {
        const today = new Date().toDateString()
        const lastReset = userData.last_credit_reset 
          ? new Date(userData.last_credit_reset).toDateString()
          : null
        
        // Reset credits if it's a new day
        if (lastReset !== today) {
          // Try to update, but don't fail if columns don't exist
          try {
            await supabase
              .from('users')
              .update({
                credits_remaining: 1,
                last_credit_reset: new Date().toISOString()
              })
              .eq('id', user.id)
          } catch {
            // Update failed, continue with defaults
          }
          creditsRemaining = 1
        } else {
          creditsRemaining = userData.credits_remaining ?? 1
        }
      } else {
        // Pro users have unlimited credits
        creditsRemaining = 9999
      }
    }
  } catch (err) {
    console.warn('[Dashboard] Error loading user data, using defaults:', err)
  }

  // Try to get onboarding status (may fail if column doesn't exist)
  try {
    const { data: settingsRow, error: settingsError } = await supabase
      .from('user_settings')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      const errorStr = String(settingsError.message || '')
      if (errorStr.includes('does not exist') || errorStr.includes('column')) {
        console.warn('[Dashboard] Schema mismatch on user_settings, using localStorage fallback')
      } else {
        console.error('[Dashboard] Error loading user settings:', settingsError)
      }
    } else {
      onboardingCompleted = Boolean(settingsRow?.onboarding_completed)
    }
  } catch (err) {
    console.warn('[Dashboard] Error loading settings, using defaults:', err)
  }

  return (
    <PlanProvider initialPlan={subscriptionTier}>
      <DashboardClient 
        initialSubscriptionTier={subscriptionTier}
        initialCreditsRemaining={creditsRemaining}
        initialOnboardingCompleted={onboardingCompleted}
      />
    </PlanProvider>
  )
}
