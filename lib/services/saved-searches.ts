import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SavedSearchPayloadSchema = z.object({
  targetIndustry: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  companySize: z.string().trim().min(2).max(80),
  targetRole: z.string().trim().min(2).max(120),
  painPoint: z.string().trim().min(4).max(240),
  offerService: z.string().trim().min(4).max(240),
  numberOfLeads: z.number().int().min(1).max(50),
})

export const SavedSearchCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  queryPayload: SavedSearchPayloadSchema,
})

export const SavedSearchUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  queryPayload: SavedSearchPayloadSchema.optional(),
  lastRunAt: z.string().datetime().optional(),
  lastNotifiedAt: z.string().datetime().optional(),
})

export const SavedSearchDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const SavedSearchRunSchema = z.object({
  id: z.string().uuid(),
})

export type SavedSearchPayload = z.infer<typeof SavedSearchPayloadSchema>

export type SavedSearchRow = {
  id: string
  user_id: string
  name: string
  query_payload: SavedSearchPayload
  last_run_at: string | null
  last_notified_at: string | null
  created_at: string
  updated_at: string
}

export async function listSavedSearchesForUser(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<SavedSearchRow[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('saved_searches')
    .select('id, user_id, name, query_payload, last_run_at, last_notified_at, created_at, updated_at')
    .eq('user_id', args.userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as SavedSearchRow[]
}

export async function createSavedSearch(args: {
  supabase: SupabaseClient
  userId: string
  input: z.infer<typeof SavedSearchCreateSchema>
}): Promise<SavedSearchRow> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('saved_searches')
    .insert({
      user_id: args.userId,
      name: args.input.name,
      query_payload: args.input.queryPayload,
    })
    .select('id, user_id, name, query_payload, last_run_at, last_notified_at, created_at, updated_at')
    .single()
  if (error || !data) throw error ?? new Error('saved_search_create_failed')
  return data as SavedSearchRow
}

export async function updateSavedSearch(args: {
  supabase: SupabaseClient
  userId: string
  id: string
  patch: {
    name?: string
    queryPayload?: SavedSearchPayload
    lastRunAt?: string
    lastNotifiedAt?: string
  }
}): Promise<SavedSearchRow> {
  const patch: {
    name?: string
    query_payload?: SavedSearchPayload
    last_run_at?: string
    last_notified_at?: string
  } = {}
  if (args.patch.name !== undefined) patch.name = args.patch.name
  if (args.patch.queryPayload !== undefined) patch.query_payload = args.patch.queryPayload
  if (args.patch.lastRunAt !== undefined) patch.last_run_at = args.patch.lastRunAt
  if (args.patch.lastNotifiedAt !== undefined) patch.last_notified_at = args.patch.lastNotifiedAt

  const { data, error } = await args.supabase
    .schema('api')
    .from('saved_searches')
    .update(patch)
    .eq('id', args.id)
    .eq('user_id', args.userId)
    .select('id, user_id, name, query_payload, last_run_at, last_notified_at, created_at, updated_at')
    .single()
  if (error || !data) throw error ?? new Error('saved_search_update_failed')
  return data as SavedSearchRow
}

export async function deleteSavedSearch(args: {
  supabase: SupabaseClient
  userId: string
  id: string
}): Promise<void> {
  const { error } = await args.supabase
    .schema('api')
    .from('saved_searches')
    .delete()
    .eq('id', args.id)
    .eq('user_id', args.userId)
  if (error) throw error
}

export async function markSavedSearchRun(args: {
  supabase: SupabaseClient
  userId: string
  id: string
  runAt?: string
}): Promise<SavedSearchRow> {
  return updateSavedSearch({
    supabase: args.supabase,
    userId: args.userId,
    id: args.id,
    patch: {
      lastRunAt: args.runAt ?? new Date().toISOString(),
    },
  })
}

export async function markSavedSearchNotified(args: {
  supabase: SupabaseClient
  userId: string
  id: string
  notifiedAt?: string
}): Promise<SavedSearchRow> {
  return updateSavedSearch({
    supabase: args.supabase,
    userId: args.userId,
    id: args.id,
    patch: {
      lastNotifiedAt: args.notifiedAt ?? new Date().toISOString(),
    },
  })
}

