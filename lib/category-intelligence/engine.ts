import type { SupabaseClient } from '@supabase/supabase-js'
import { getCategorySignalInsights } from '@/lib/services/category-signal-intelligence'

export async function getWorkspaceCategorySignalIntelligence(args: { supabase: SupabaseClient; workspaceId: string; windowDays: number }) {
  return getCategorySignalInsights(args)
}

