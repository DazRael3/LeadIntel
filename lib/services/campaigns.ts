import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const CampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'archived'])
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>

export const CampaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  objective: z.string().trim().max(2000).nullable().optional(),
  status: CampaignStatusSchema.optional(),
  leadIds: z.array(z.string().uuid()).max(200).optional(),
})

export const CampaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  objective: z.string().trim().max(2000).nullable().optional(),
  status: CampaignStatusSchema.optional(),
})

export const CampaignAttachLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
})

export const CampaignDetachLeadSchema = z.object({
  leadId: z.string().uuid(),
})

export type CampaignRow = {
  id: string
  workspace_id: string
  created_by: string
  name: string
  objective: string | null
  status: CampaignStatus
  created_at: string
  updated_at: string
}

export type CampaignLeadJoinRow = {
  campaign_id: string
  lead_id: string
  workspace_id: string
  added_by: string
  created_at: string
}

export type CampaignLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  prospect_email: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

export function canCreateCampaign(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager' || role === 'rep'
}

export function canManageCampaign(role: string, createdBy: string, userId: string): boolean {
  if (role === 'owner' || role === 'admin' || role === 'manager') return true
  return role === 'rep' && createdBy === userId
}

export async function listCampaignsForWorkspace(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<CampaignRow[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('campaigns')
    .select('id, workspace_id, created_by, name, objective, status, created_at, updated_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

export async function getCampaignById(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
}): Promise<CampaignRow | null> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('campaigns')
    .select('id, workspace_id, created_by, name, objective, status, created_at, updated_at')
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.campaignId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as CampaignRow | null
}

export async function createCampaignRecord(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  input: z.infer<typeof CampaignCreateSchema>
}): Promise<CampaignRow> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('campaigns')
    .insert({
      workspace_id: args.workspaceId,
      created_by: args.userId,
      name: args.input.name,
      objective: args.input.objective ?? null,
      status: args.input.status ?? 'draft',
    })
    .select('id, workspace_id, created_by, name, objective, status, created_at, updated_at')
    .single()

  if (error || !data) throw error ?? new Error('campaign_create_failed')
  return data as CampaignRow
}

export async function updateCampaignRecord(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
  patch: z.infer<typeof CampaignUpdateSchema>
}): Promise<CampaignRow> {
  const updates: Record<string, unknown> = {}
  if (args.patch.name !== undefined) updates.name = args.patch.name
  if (args.patch.objective !== undefined) updates.objective = args.patch.objective
  if (args.patch.status !== undefined) updates.status = args.patch.status

  const { data, error } = await args.supabase
    .schema('api')
    .from('campaigns')
    .update(updates)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.campaignId)
    .select('id, workspace_id, created_by, name, objective, status, created_at, updated_at')
    .single()

  if (error || !data) throw error ?? new Error('campaign_update_failed')
  return data as CampaignRow
}

export async function deleteCampaignRecord(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
}): Promise<void> {
  const { error } = await args.supabase
    .schema('api')
    .from('campaigns')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.campaignId)

  if (error) throw error
}

export async function getOwnedLeadRows(args: {
  supabase: SupabaseClient
  userId: string
  leadIds: string[]
}): Promise<CampaignLeadRow[]> {
  if (args.leadIds.length === 0) return []
  const { data, error } = await args.supabase
    .schema('api')
    .from('leads')
    .select('id, company_name, company_domain, company_url, prospect_email, ai_personalized_pitch, created_at')
    .eq('user_id', args.userId)
    .in('id', args.leadIds)

  if (error) throw error
  return (data ?? []) as CampaignLeadRow[]
}

export async function listCampaignLeadJoins(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
}): Promise<CampaignLeadJoinRow[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('campaign_leads')
    .select('campaign_id, lead_id, workspace_id, added_by, created_at')
    .eq('workspace_id', args.workspaceId)
    .eq('campaign_id', args.campaignId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as CampaignLeadJoinRow[]
}

export async function attachLeadsToCampaign(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
  userId: string
  leadIds: string[]
}): Promise<void> {
  if (args.leadIds.length === 0) return
  const rows = args.leadIds.map((leadId) => ({
    campaign_id: args.campaignId,
    lead_id: leadId,
    workspace_id: args.workspaceId,
    added_by: args.userId,
  }))

  const { error } = await args.supabase
    .schema('api')
    .from('campaign_leads')
    .upsert(rows, { onConflict: 'campaign_id,lead_id' })

  if (error) throw error
}

export async function detachLeadFromCampaign(args: {
  supabase: SupabaseClient
  workspaceId: string
  campaignId: string
  leadId: string
}): Promise<void> {
  const { error } = await args.supabase
    .schema('api')
    .from('campaign_leads')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('campaign_id', args.campaignId)
    .eq('lead_id', args.leadId)

  if (error) throw error
}
