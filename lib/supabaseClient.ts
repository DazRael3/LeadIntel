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
  current_workspace_id?: string | null
  credits_remaining?: number
  last_credit_reset?: string
  last_unlock_date?: string
  created_at: string
  updated_at?: string
}

export interface Profile {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  full_name?: string | null
  title?: string | null
  timezone?: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  workspace_id?: string | null
  owner_user_id: string
  name: string
  slug?: string | null
  status: 'active' | 'trialing' | 'suspended' | 'cancelled'
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
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
  user_id?: string
  organization_id?: string | null
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
  organization_id?: string | null
  stripe_subscription_id?: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  current_period_start?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface UsageEvent {
  id: string
  user_id: string
  organization_id?: string | null
  status: 'reserved' | 'complete' | 'cancelled'
  object_type?: 'pitch' | 'report' | null
  object_id?: string | null
  feature_key?: string | null
  units?: number
  expires_at?: string | null
  meta?: Record<string, unknown>
  created_at: string
}

export interface LeadEnrichment {
  id: string
  organization_id: string
  lead_id: string
  provider: string
  enrichment_status: 'pending' | 'complete' | 'failed'
  confidence?: number | null
  payload: Record<string, unknown>
  enriched_at?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface LeadScore {
  id: string
  organization_id: string
  lead_id: string
  model_version: string
  score: number
  grade?: string | null
  factors: Record<string, unknown>
  scored_by_user_id?: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  organization_id: string
  created_by: string
  name: string
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived'
  channel: 'email' | 'linkedin' | 'multichannel'
  description?: string | null
  objective?: string | null
  audience_filter?: Record<string, unknown>
  schedule_start?: string | null
  schedule_end?: string | null
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  organization_id: string
  campaign_id: string
  lead_id: string
  stage: 'queued' | 'pending_approval' | 'approved' | 'sent' | 'replied' | 'failed'
  personalized_copy?: string | null
  metadata?: Record<string, unknown>
  last_contacted_at?: string | null
  created_at: string
  updated_at: string
}

export interface AIGeneration {
  id: string
  organization_id: string
  user_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  generation_type:
    | 'lead_summary'
    | 'lead_outreach'
    | 'campaign_sequence'
    | 'enrichment_summary'
    | 'other'
  model?: string | null
  prompt_hash?: string | null
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  cost_usd?: number | null
  status: 'queued' | 'succeeded' | 'failed'
  content?: Record<string, unknown>
  error_message?: string | null
  created_at: string
  updated_at: string
}

export interface SavedSearch {
  id: string
  organization_id: string
  user_id: string
  name: string
  query: Record<string, unknown>
  is_shared: boolean
  last_run_at?: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  workspace_id?: string | null
  organization_id?: string | null
  actor_user_id: string
  action: string
  target_type: string
  target_id?: string | null
  meta?: Record<string, unknown>
  ip?: string | null
  user_agent?: string | null
  created_at: string
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
