import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { sendEmailWithResend } from '@/lib/email/resend'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { listPublishables, seedPublishQueue, type PublishQueueType, type Publishable } from '@/lib/growth/seedPublishQueue'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import { COMPARE_PAGES } from '@/lib/compare/registry'
import { USE_CASES } from '@/lib/use-cases/registry'

type PublishQueueRow = {
  id: string
  type: PublishQueueType
  slug: string
  scheduled_for: string
}

function hasServiceRoleConfigured(): boolean {
  return Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
}

function hasResendConfigured(): boolean {
  return Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean((serverEnv.RESEND_FROM_EMAIL ?? '').trim())
}

function sinceMs(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: { 'user-agent': 'LeadIntelGrowthCycle/1.0' },
      signal: controller.signal,
    })
    const text = await res.text()
    return { status: res.status, text }
  } finally {
    clearTimeout(t)
  }
}

function parseSitemapLocs(xml: string): Set<string> {
  const set = new Set<string>()
  const re = /<loc>([^<]+)<\/loc>/gi
  for (const m of xml.matchAll(re)) {
    const v = (m[1] ?? '').trim()
    if (v) set.add(v)
  }
  return set
}

function requiresOgMeta(html: string): boolean {
  const t = html.toLowerCase()
  const hasTitle = t.includes('property="og:title"') || t.includes("property='og:title'")
  const hasDesc = t.includes('property="og:description"') || t.includes("property='og:description'")
  return hasTitle && hasDesc
}

function validateUseCaseHtml(html: string): string | null {
  const must = ['problem → why now', 'what to look for', 'angle library', 'templates', 'personalization tokens']
  const t = html.toLowerCase()
  const missing = must.filter((m) => !t.includes(m))
  if (missing.length > 0) return `use_case_missing_sections:${missing.join(',')}`
  return null
}

function validateCompareHtml(html: string): string | null {
  const t = html.toLowerCase()
  if (!t.includes('evaluation checklist')) return 'compare_missing_evaluation_checklist'
  if (!t.includes('comparison table')) return 'compare_missing_comparison_table'
  return null
}

function validateTourHtml(html: string): string | null {
  const t = html.toLowerCase()
  if (!t.includes('product tour')) return 'tour_missing_title'
  if (!t.includes('next steps')) return 'tour_missing_next_steps'
  return null
}

function validateTemplateRegistry(slug: string): string | null {
  const tpl = TEMPLATE_LIBRARY.find((t) => t.slug === slug)
  if (!tpl) return 'template_not_found_in_registry'
  if (tpl.body.trim().length < 280) return 'template_body_too_short'
  return null
}

function postDraftsForItem(p: Publishable, url: string): Array<{ channel: 'linkedin' | 'community'; content: string; related_url: string }> {
  const bullets: string[] = []
  if (p.type === 'template') {
    const tpl = TEMPLATE_LIBRARY.find((t) => t.slug === p.slug)
    if (tpl) {
      bullets.push(`Built for ${tpl.trigger.replace(/_/g, ' ')} signals (${tpl.channel}).`)
      bullets.push('Uses deterministic tokens so reps can personalize fast without guessing.')
    } else {
      bullets.push('A production-ready outbound template tied to a “why now” trigger.')
      bullets.push('Designed for fast personalization and consistent team messaging.')
    }
  } else if (p.type === 'use_case') {
    const uc = USE_CASES.find((u) => u.slug === p.slug)
    if (uc) {
      bullets.push(uc.problem)
      bullets.push(uc.whyNow)
    } else {
      bullets.push('A focused outbound play built around a specific “why now” trigger.')
      bullets.push('Includes angles + copy you can adapt without starting from scratch.')
    }
  } else if (p.type === 'compare') {
    const cmp = COMPARE_PAGES.find((c) => c.slug === p.slug)
    bullets.push('Conservative workflow comparison (no hand-wavy claims).')
    bullets.push(cmp ? `Includes an evaluation checklist: LeadIntel vs ${cmp.competitorName}.` : 'Includes an evaluation checklist for a clean decision.')
  } else {
    bullets.push(p.summary)
    bullets.push('Short, practical, and designed for outbound execution.')
  }

  const takeaway = bullets.filter(Boolean).slice(0, 2)
  const body = [
    `New: ${p.title}`,
    '',
    ...takeaway.map((b) => `- ${b}`),
    '',
    `→ ${url}`,
  ].join('\n')

  const community = [
    `New on LeadIntel: ${p.title}`,
    '',
    ...takeaway.map((b) => `- ${b}`),
    '',
    url,
  ].join('\n')

  return [
    { channel: 'linkedin', content: body, related_url: url },
    { channel: 'community', content: community, related_url: url },
  ]
}

export async function runGrowthCycle(args: { dryRun?: boolean; limit?: number }) {
  const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.max(1, Math.min(10, Math.floor(args.limit))) : 3

  if (args.dryRun) {
    return { status: 'skipped' as const, summary: { reason: 'dry_run', limit } }
  }

  if (!hasServiceRoleConfigured()) {
    return { status: 'skipped' as const, summary: { reason: 'supabase_admin_not_configured', limit } }
  }

  const appUrl = getAppUrl()
  const supabase = createSupabaseAdminClient({ schema: 'api' })

  // Seed queue from existing registries (idempotent).
  const seed = await seedPublishQueue({ supabase })
  const publishables = listPublishables()
  const byKey = new Map<string, Publishable>(publishables.map((p) => [`${p.type}:${p.slug}`, p]))

  // Fetch sitemap once for route validation.
  let sitemapSet: Set<string> | null = null
  try {
    const sitemapUrl = `${appUrl}/sitemap.xml`
    const res = await fetchTextWithTimeout(sitemapUrl, 5000)
    if (res.status === 200) sitemapSet = parseSitemapLocs(res.text)
  } catch {
    sitemapSet = null
  }

  // Publish step: mark up to limit items as published after quality checks.
  const nowIso = new Date().toISOString()
  const { data: queuedRows, error: queuedErr } = await supabase
    .from('publish_queue')
    .select('id, type, slug, scheduled_for')
    .eq('status', 'queued')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (queuedErr) {
    return { status: 'skipped' as const, summary: { reason: 'publish_queue_not_available', seed, limit } }
  }

  const rows = (queuedRows ?? []) as PublishQueueRow[]
  let publishedCount = 0
  let failedCount = 0
  const publishedThisRun: Publishable[] = []

  for (const r of rows) {
    const key = `${r.type}:${r.slug}`
    const item = byKey.get(key) ?? null
    if (!item) {
      failedCount += 1
      await supabase.from('publish_queue').update({ status: 'failed', last_error: 'unknown_item_not_in_registry' }).eq('id', r.id)
      continue
    }

    const url = `${appUrl}${item.path}`

    if (sitemapSet && !sitemapSet.has(url)) {
      failedCount += 1
      await supabase.from('publish_queue').update({ status: 'failed', last_error: 'missing_from_sitemap' }).eq('id', r.id)
      continue
    }

    // Registry-based template quality check (cheap).
    if (item.type === 'template') {
      const err = validateTemplateRegistry(item.slug)
      if (err) {
        failedCount += 1
        await supabase.from('publish_queue').update({ status: 'failed', last_error: err }).eq('id', r.id)
        continue
      }
    }

    // Route + OG validation via live HTML.
    let html: string
    try {
      const fetched = await fetchTextWithTimeout(url, 7000)
      if (fetched.status !== 200) {
        failedCount += 1
        await supabase
          .from('publish_queue')
          .update({ status: 'failed', last_error: `route_not_200:${fetched.status}` })
          .eq('id', r.id)
        continue
      }
      html = fetched.text.slice(0, 120000) // defensive cap
    } catch {
      failedCount += 1
      await supabase.from('publish_queue').update({ status: 'failed', last_error: 'route_fetch_failed' }).eq('id', r.id)
      continue
    }

    if (!requiresOgMeta(html)) {
      failedCount += 1
      await supabase.from('publish_queue').update({ status: 'failed', last_error: 'missing_og_meta' }).eq('id', r.id)
      continue
    }

    const typeErr =
      item.type === 'use_case'
        ? validateUseCaseHtml(html)
        : item.type === 'compare'
          ? validateCompareHtml(html)
          : item.type === 'tour'
            ? validateTourHtml(html)
            : null
    if (typeErr) {
      failedCount += 1
      await supabase.from('publish_queue').update({ status: 'failed', last_error: typeErr }).eq('id', r.id)
      continue
    }

    publishedCount += 1
    publishedThisRun.push(item)
    await supabase
      .from('publish_queue')
      .update({ status: 'published', published_at: nowIso, last_error: null })
      .eq('id', r.id)
  }

  // Post queue generation (manual distribution drafts, idempotent via unique index).
  let postsQueuedCount = 0
  if (publishedThisRun.length > 0) {
    const drafts = publishedThisRun.flatMap((p) => postDraftsForItem(p, `${appUrl}${p.path}`))
    if (drafts.length > 0) {
      const { data: postData } = await supabase
        .from('post_queue')
        .upsert(
          drafts.map((d) => ({ ...d, status: 'queued' as const })),
          { onConflict: 'channel,related_url,content', ignoreDuplicates: true }
        )
        .select('id')
      postsQueuedCount = Array.isArray(postData) ? postData.length : 0
    }
  }

  // Distribution email: max once per 24h.
  let emailedCount = 0
  let distributionStatus: 'sent' | 'skipped' = 'skipped'
  let distributionReason: string | null = null

  const { data: stateRow } = await supabase.from('growth_state').select('key, last_distribution_at').eq('key', 'growth_cycle').maybeSingle()
  const lastDistributionAt = (stateRow as { last_distribution_at?: string | null } | null)?.last_distribution_at ?? null
  const lastMs = sinceMs(lastDistributionAt)
  if (lastMs && Date.now() - lastMs < 24 * 3600 * 1000) {
    distributionReason = 'already_sent_within_24h'
  } else if (!hasResendConfigured()) {
    distributionReason = 'resend_not_configured'
  } else {
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: recentPublished } = await supabase
      .from('publish_queue')
      .select('type, slug, published_at')
      .eq('status', 'published')
      .gte('published_at', sinceIso)
      .order('published_at', { ascending: false })
      .limit(10)

    const recent = (recentPublished ?? []) as Array<{ type: PublishQueueType; slug: string }>
    if (recent.length === 0) {
      distributionReason = 'no_recent_publishes'
    } else {
      // Subscribers: users who opted into product tips/updates.
      const { data: subsRows, error: subsErr } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('product_tips_opt_in', true)
        .limit(2000)
      if (subsErr) {
        distributionReason = 'subscribers_query_failed'
      } else {
        const userIds = Array.from(new Set((subsRows ?? []).map((r: { user_id?: string }) => r.user_id).filter(Boolean))) as string[]
        if (userIds.length === 0) {
          distributionReason = 'no_subscribers'
        } else {
          const { data: userRows } = await supabase.from('users').select('id, email').in('id', userIds).limit(2000)
          const emails = (userRows ?? [])
            .map((r: { email?: string | null }) => (r.email ?? '').trim())
            .filter((email: string) => email.length > 0)

          if (emails.length === 0) {
            distributionReason = 'no_emails'
          } else {
            const entries = recent
              .map((r) => {
                const p = byKey.get(`${r.type}:${r.slug}`) ?? null
                if (!p) return null
                const url = `${appUrl}${p.path}`
                return { title: p.title, summary: p.summary, url }
              })
              .filter(Boolean)
              .slice(0, 10) as Array<{ title: string; summary: string; url: string }>

            const subject = 'What’s new in LeadIntel'
            const text = [
              'New and updated resources:',
              '',
              ...entries.map((e) => `- ${e.title}: ${e.summary}\n  ${e.url}`),
              '',
              `Manage email preferences: ${appUrl}/settings/notifications`,
            ].join('\n')

            const html = [
              '<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#0f172a;">',
              '<h2 style="margin:0 0 12px 0;">What’s new in LeadIntel</h2>',
              '<div style="margin:0 0 12px 0; color:#334155; font-size:14px;">New and updated resources:</div>',
              '<ul style="padding-left:18px; margin:0;">',
              ...entries.map(
                (e) =>
                  `<li style="margin:0 0 10px 0;"><div style="font-weight:700;">${escapeHtml(e.title)}</div><div style="color:#334155; font-size:14px; margin-top:2px;">${escapeHtml(
                    e.summary
                  )}</div><div style="margin-top:4px;"><a href="${escapeHtml(e.url)}">${escapeHtml(e.url)}</a></div></li>`
              ),
              '</ul>',
              `<div style="margin-top:14px; font-size:12px; color:#64748b;">Manage email preferences: <a href="${escapeHtml(
                `${appUrl}/settings/notifications`
              )}">${escapeHtml(`${appUrl}/settings/notifications`)}</a></div>`,
              '</div>',
            ].join('')

            // Resend supports multiple recipients; keep batch bounded.
            const res = await sendEmailWithResend({
              from: (serverEnv.RESEND_FROM_EMAIL ?? '').trim(),
              to: emails,
              replyTo: SUPPORT_EMAIL,
              subject,
              text,
              html,
              tags: [{ name: 'kind', value: 'growth_updates' }, { name: 'source', value: 'growth_cycle' }],
            })

            if (res.ok) {
              emailedCount = emails.length
              distributionStatus = 'sent'
              await supabase.from('growth_state').upsert({ key: 'growth_cycle', last_distribution_at: nowIso }, { onConflict: 'key' })
            } else {
              distributionReason = 'send_failed'
            }
          }
        }
      }
    }
  }

  return {
    status: 'ok' as const,
    summary: {
      limit,
      seed,
      publishedCount,
      failedCount,
      postsQueuedCount,
      distribution: { status: distributionStatus, reason: distributionReason, emailedCount },
    },
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

