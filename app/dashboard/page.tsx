import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import { getPlan } from '@/lib/billing/plan'
import { PlanProvider } from '@/components/PlanProvider'
import { getBuildInfo } from '@/lib/debug/buildInfo'
import { checkLifecycleForUser } from '@/lib/lifecycle/checkUser'
import { isReviewMode } from '@/lib/review/server'

export const dynamic = 'force-dynamic'

let hasLoggedApiSchemaHint = false

function maybeLogApiSchemaHint(error: unknown): void {
  if (process.env.NODE_ENV === 'production') return
  if (hasLoggedApiSchemaHint) return

  const err = error as { code?: unknown; message?: unknown }
  const code = typeof err?.code === 'string' ? err.code : ''
  const message = typeof err?.message === 'string' ? err.message : ''

  if (code === 'PGRST106' && message.toLowerCase().includes('invalid schema')) {
    console.warn(
      '[Supabase config] REST API is not exposing the "api" schema. ' +
        'In Supabase → Settings → API, add `api` to the "Exposed schemas" list, ' +
        'then save and retry.'
    )
    hasLoggedApiSchemaHint = true
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const supabase = await createClient()
  const reviewMode = await isReviewMode()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/dashboard')
  }

  // Safe defaults
  let subscriptionTier: 'free' | 'pro' = 'free'
  let creditsRemaining = 1
  let onboardingCompleted = false
  let autopilotEnabled = false
  let hasIcp = false
  let tourCompletedAt: string | null = null
  const initialCompany =
    typeof sp.company === 'string' ? sp.company.trim().slice(0, 1000) : undefined

  const focusParam = typeof sp.focus === 'string' ? sp.focus.trim() : ''

  // Try to get subscription tier from billing module
  try {
    subscriptionTier = await getPlan(supabase as Parameters<typeof getPlan>[0], user.id)
  } catch (err) {
    console.warn('[Dashboard] Error getting plan, defaulting to free:', err)
    maybeLogApiSchemaHint(err)
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
        maybeLogApiSchemaHint(userError)
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
        if (!reviewMode && lastReset !== today) {
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
    maybeLogApiSchemaHint(err)
  }

  // Try to get onboarding status (may fail if column doesn't exist)
  try {
    const { data: settingsRow, error: settingsError } = await supabase
      .from('user_settings')
      .select('onboarding_completed, autopilot_enabled, ideal_customer, tour_completed_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (settingsError) {
      const errorStr = String(settingsError.message || '')
      if (errorStr.includes('does not exist') || errorStr.includes('column')) {
        console.warn('[Dashboard] Schema mismatch on user_settings, using localStorage fallback')
      } else {
        console.error('[Dashboard] Error loading user settings:', settingsError)
        maybeLogApiSchemaHint(settingsError)
      }
    } else {
      onboardingCompleted = Boolean(settingsRow?.onboarding_completed)
      autopilotEnabled = Boolean((settingsRow as { autopilot_enabled?: boolean } | null)?.autopilot_enabled)
      hasIcp = Boolean((settingsRow as { ideal_customer?: string | null } | null)?.ideal_customer?.trim())
      tourCompletedAt = ((settingsRow as { tour_completed_at?: string | null } | null)?.tour_completed_at ?? null) || null
    }
  } catch (err) {
    console.warn('[Dashboard] Error loading settings, using defaults:', err)
    maybeLogApiSchemaHint(err)
  }

  const buildInfo = getBuildInfo()

  // "Lazy cron": best-effort lifecycle evaluation on user activity (Hobby-safe).
  // Never block dashboard render; swallow errors.
  if (!reviewMode) {
    void checkLifecycleForUser(user.id, { triggeredBy: 'request' }).catch(() => {})
  }

  return (
    <PlanProvider initialPlan={subscriptionTier} initialBuildInfo={buildInfo}>
      <DashboardClient 
        initialSubscriptionTier={subscriptionTier}
        initialCreditsRemaining={creditsRemaining}
        initialOnboardingCompleted={onboardingCompleted}
        initialAutopilotEnabled={autopilotEnabled}
        initialCompanyInput={initialCompany}
        initialHasIcp={hasIcp}
        initialTourCompletedAt={tourCompletedAt}
        initialFocus={focusParam === 'pitch' ? 'pitch' : null}
      />
    </PlanProvider>
  )
}
