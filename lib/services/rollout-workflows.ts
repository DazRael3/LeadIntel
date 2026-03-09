import type { SupabaseClient } from '@supabase/supabase-js'
import { getWorkspaceMembership } from '@/lib/team/workspace'

export type RolloutCreateResult =
  | { ok: true; rolloutJobId: string; applied: number; skipped: number; failed: number }
  | { ok: false; code: 'FORBIDDEN' | 'VALIDATION_ERROR' | 'DATABASE_ERROR'; message: string }

type TemplateRow = {
  id: string
  workspace_id: string
  set_id: string | null
  slug: string
  title: string
  channel: string
  trigger: string
  persona: string
  length: string
  subject: string | null
  body: string
  tokens: string[]
  status: string
}

export function computeImportedSlug(args: { slug: string; originTemplateId: string }): string {
  const base = (args.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-')
  const suffix = (args.originTemplateId ?? '').replace(/-/g, '').slice(0, 6) || 'import'
  const max = 72
  const trimmed = base.length > max ? base.slice(0, max) : base
  return `${trimmed}-imported-${suffix}`.slice(0, 80)
}

async function insertCopiedTemplate(args: {
  supabase: SupabaseClient
  targetWorkspaceId: string
  actorUserId: string
  source: TemplateRow
  slug: string
  importedAtIso: string
}): Promise<{ id: string } | null> {
  const { data } = await args.supabase
    .schema('api')
    .from('templates')
    .insert({
      workspace_id: args.targetWorkspaceId,
      set_id: null,
      slug: args.slug,
      title: args.source.title,
      channel: args.source.channel,
      trigger: args.source.trigger,
      persona: args.source.persona,
      length: args.source.length,
      subject: args.source.subject,
      body: args.source.body,
      tokens: args.source.tokens,
      status: 'draft',
      created_by: args.actorUserId,
      import_source: 'imported',
      origin_workspace_id: args.source.workspace_id,
      origin_template_id: args.source.id,
      imported_at: args.importedAtIso,
      imported_by: args.actorUserId,
    })
    .select('id')
    .single()
  const id = (data as { id?: unknown } | null)?.id
  return typeof id === 'string' ? { id } : null
}

export async function createTemplateRollout(args: {
  supabase: SupabaseClient
  actorUserId: string
  sourceWorkspaceId: string
  templateId: string
  targetWorkspaceIds: string[]
  name: string
}): Promise<RolloutCreateResult> {
  const name = args.name.trim() || 'Template rollout'
  const targets = Array.from(new Set(args.targetWorkspaceIds.filter(Boolean))).slice(0, 50)
  if (targets.length === 0) return { ok: false, code: 'VALIDATION_ERROR', message: 'No target workspaces selected.' }

  const sourceRole = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: args.sourceWorkspaceId, userId: args.actorUserId })
  if (!sourceRole || (sourceRole.role !== 'owner' && sourceRole.role !== 'admin')) {
    return { ok: false, code: 'FORBIDDEN', message: 'Access restricted.' }
  }

  const { data: template } = await args.supabase
    .schema('api')
    .from('templates')
    .select('id, workspace_id, set_id, slug, title, channel, trigger, persona, length, subject, body, tokens, status')
    .eq('id', args.templateId)
    .eq('workspace_id', args.sourceWorkspaceId)
    .maybeSingle()

  if (!template) return { ok: false, code: 'VALIDATION_ERROR', message: 'Template not found.' }
  const source = template as unknown as TemplateRow

  const { data: job } = await args.supabase
    .schema('api')
    .from('rollout_jobs')
    .insert({ source_workspace_id: args.sourceWorkspaceId, name, created_by: args.actorUserId, status: 'processing', meta: { templateId: source.id, templateSlug: source.slug, targetsCount: targets.length } })
    .select('id')
    .single()

  const rolloutJobId = (job as { id?: unknown } | null)?.id
  if (typeof rolloutJobId !== 'string') return { ok: false, code: 'DATABASE_ERROR', message: 'Failed to create rollout job.' }

  let applied = 0
  let skipped = 0
  let failed = 0
  const importedAtIso = new Date().toISOString()

  for (const targetWorkspaceId of targets) {
    const targetRole = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: targetWorkspaceId, userId: args.actorUserId })
    if (!targetRole || (targetRole.role !== 'owner' && targetRole.role !== 'admin')) {
      skipped += 1
      await args.supabase.schema('api').from('rollout_items').insert({
        rollout_job_id: rolloutJobId,
        source_template_id: source.id,
        target_workspace_id: targetWorkspaceId,
        status: 'skipped',
        error_sanitized: 'Insufficient permissions in target workspace.',
      })
      continue
    }

    // Attempt same slug first; on conflict, retry with imported slug.
    let inserted: { id: string } | null = null
    try {
      inserted = await insertCopiedTemplate({
        supabase: args.supabase,
        targetWorkspaceId,
        actorUserId: args.actorUserId,
        source,
        slug: source.slug,
        importedAtIso,
      })
    } catch {
      // ignore; retry with imported slug
    }

    if (!inserted) {
      try {
        inserted = await insertCopiedTemplate({
          supabase: args.supabase,
          targetWorkspaceId,
          actorUserId: args.actorUserId,
          source,
          slug: computeImportedSlug({ slug: source.slug, originTemplateId: source.id }),
          importedAtIso,
        })
      } catch {
        inserted = null
      }
    }

    if (!inserted) {
      failed += 1
      await args.supabase.schema('api').from('rollout_items').insert({
        rollout_job_id: rolloutJobId,
        source_template_id: source.id,
        target_workspace_id: targetWorkspaceId,
        status: 'failed',
        error_sanitized: 'Template copy failed.',
      })
      continue
    }

    applied += 1
    await args.supabase.schema('api').from('rollout_items').insert({
      rollout_job_id: rolloutJobId,
      source_template_id: source.id,
      target_workspace_id: targetWorkspaceId,
      target_template_id: inserted.id,
      status: 'applied',
      applied_at: importedAtIso,
    })
  }

  await args.supabase
    .schema('api')
    .from('rollout_jobs')
    .update({ status: failed > 0 ? 'failed' : 'completed', meta: { templateId: source.id, templateSlug: source.slug, targetsCount: targets.length, applied, skipped, failed } })
    .eq('id', rolloutJobId)

  return { ok: true, rolloutJobId, applied, skipped, failed }
}

