// Database types
// NOTE: Do not use the singleton supabase export - use createClient() from @/lib/supabase/client instead
// This file is kept for backward compatibility of type exports only
export interface TriggerEvent {
  id: string
  company_name: string
  event_type: 'funding' | 'new_hires' | 'expansion' | 'product_launch' | 'partnership'
  event_description: string
  source_url: string
  detected_at: string
  company_url?: string
  company_domain?: string
  headline?: string
  created_at: string
}

export interface User {
  id: string
  email: string
  subscription_tier: 'free' | 'pro'
  stripe_customer_id?: string
  credits_remaining?: number
  last_credit_reset?: string
  last_unlock_date?: string
  created_at: string
}

export interface Pitch {
  id: string
  user_id: string
  company_url: string
  company_name: string
  pitch_content: string
  created_at: string
}

export interface Lead {
  id: string
  company_name: string
  trigger_event: string
  contact_email?: string
  prospect_email?: string
  prospect_linkedin?: string
  ai_personalized_pitch: string
  company_domain?: string
  company_url?: string
  lead_score?: number
  fit_score?: number
  growth_potential?: number
  enterprise_stability?: number
  funding_amount?: number
  industry?: string
  years_in_business?: number
  tech_stack_count?: number
  recent_hiring_count?: number
  growth_signals?: string[]
  created_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  lead_id: string
  watched_at: string
  last_checked_at: string
  expires_at: string
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string
  what_you_sell: string
  ideal_customer: string
  target_industries?: string[]
  sender_name?: string
  sender_email?: string
  onboarding_completed: boolean
  saved_companies?: any
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id?: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface WebsiteVisitor {
  id: string
  ip_address: string
  user_agent?: string
  referer?: string
  company_name?: string
  company_domain?: string
  company_industry?: string
  visited_at: string
  created_at: string
}
