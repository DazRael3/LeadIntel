import { NextRequest, NextResponse } from 'next/server'
import {
  claimDemoSessionForUser,
  clearDemoHandoffCookie,
  getDemoHandoffToken,
} from '@/lib/demo/handoff'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function claimDemoHandoffFromRequest(args: {
  request: NextRequest
  supabase: SupabaseClient
  userId: string
}): Promise<{ claimedLeadId?: string }> {
  const token = getDemoHandoffToken(args.request)
  if (!token) return {}

  const claim = await claimDemoSessionForUser({
    token,
    userId: args.userId,
    supabase: args.supabase,
  })

  if (claim.status === 'claimed') {
    return { claimedLeadId: claim.leadId }
  }
  return {}
}

export function clearDemoHandoffCookieOnResponse(response: NextResponse): void {
  clearDemoHandoffCookie(response)
}

export async function claimDemoHandoffFromCookieToken(args: {
  token: string | null | undefined
  supabase: SupabaseClient
  userId: string
}): Promise<{ claimedLeadId?: string }> {
  const token = typeof args.token === 'string' ? args.token.trim() : ''
  if (token.length === 0) return {}
  const claim = await claimDemoSessionForUser({
    token,
    userId: args.userId,
    supabase: args.supabase,
  })
  if (claim.status === 'claimed') {
    return { claimedLeadId: claim.leadId }
  }
  return {}
}
