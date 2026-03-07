import fs from 'fs'
import path from 'path'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import { USE_CASE_PLAYBOOKS } from '@/lib/use-cases/playbooks'
import { COMPARE_PAGES } from '@/lib/compare/registry'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import sitemap from '@/app/sitemap'

export type ContentAuditStatus = 'ok' | 'warn' | 'error'
export type ContentAuditFailure = { code: string; message: string; path?: string }

type AuditResult =
  | { ok: true; status: ContentAuditStatus; summary: Record<string, unknown>; failures: ContentAuditFailure[] }
  | { ok: false; status: ContentAuditStatus; failures: ContentAuditFailure[]; summary?: Record<string, unknown> }

const REQUIRED_ROUTES = [
  '/pricing',
  '/support',
  '/tour',
  '/templates',
  '/compare',
  '/use-cases',
  '/how-scoring-works',
]

const FORBIDDEN = [
  /TODO\b/i,
  /\bTBD\b/i,
  /coming soon/i,
  /lorem/i,
  // Avoid false positives from TSX input placeholder= attributes.
  /\bplaceholder\b(?!\s*=)/i,
]

function hasBracketTokens(text: string): boolean {
  // Detect bracket-style placeholder tokens like [NAME] or [initiative].
  // This intentionally does NOT flag normal punctuation, markdown links, or JSON arrays.
  return /\[[a-z0-9_]{2,40}\]/i.test(text)
}

function listCurlyTokens(text: string): string[] {
  const set = new Set<string>()
  const re = /\{\{[a-z0-9_]+\}\}/gi
  for (const m of text.matchAll(re)) set.add(m[0].toLowerCase())
  return Array.from(set)
}

function hasCtaQuestion(text: string): boolean {
  const tail = text.slice(Math.max(0, text.length - 280)).toLowerCase()
  if (!tail.includes('?')) return false
  return (
    tail.includes('worth') ||
    tail.includes('open to') ||
    tail.includes('up for') ||
    tail.includes('quick') ||
    tail.includes('can we') ||
    tail.includes('would you') ||
    tail.includes('does it make sense')
  )
}

function readText(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

function normalizePathname(input: string): string {
  const raw = input.trim()
  if (!raw) return '/'

  let pathname = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname
    } catch {
      pathname = raw
    }
  }

  if (!pathname.startsWith('/')) pathname = `/${pathname}`
  // Remove trailing slash except root.
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
  return pathname
}

function getSitemapPathnames(): Set<string> {
  // Deterministic + CI-safe: use the exact Next sitemap generator used in production.
  // This avoids filesystem string-matching or relying on a running server.
  const entries = sitemap()
  const set = new Set<string>()
  for (const e of entries) {
    if (!e || typeof e.url !== 'string') continue
    set.add(normalizePathname(e.url))
  }
  return set
}

function listFiles(dir: string, exts: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(full, exts, out)
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full)
  }
  return out
}

export function auditContent(workspaceRoot: string): AuditResult {
  const failures: ContentAuditFailure[] = []

  // 1) Sitemap required routes
  let sitemapPaths: Set<string> | null = null
  try {
    sitemapPaths = getSitemapPathnames()
  } catch {
    sitemapPaths = null
  }
  for (const r of REQUIRED_ROUTES) {
    const required = normalizePathname(r)
    if (!sitemapPaths || !sitemapPaths.has(required)) {
      failures.push({ code: 'SITEMAP_MISSING_ROUTE', message: `Sitemap missing route: ${r}`, path: r })
    }
  }

  // 2) Templates quality gates (registry-driven)
  if (TEMPLATE_LIBRARY.length < 60) {
    failures.push({
      code: 'TEMPLATES_MIN_COUNT',
      message: `Templates: expected >= 60, got ${TEMPLATE_LIBRARY.length}`,
    })
  }

  for (const t of TEMPLATE_LIBRARY) {
    const joined = `${t.subject ?? ''}\n${t.body}\n${t.notes}`
    if (hasBracketTokens(joined)) {
      failures.push({
        code: 'TEMPLATE_BRACKET_TOKENS',
        message: `Template ${t.slug}: contains bracket token characters [ or ]`,
        path: `/templates/${t.slug}`,
      })
    }
    if (!t.notes || t.notes.trim().length < 20) {
      failures.push({
        code: 'TEMPLATE_NOTES_REQUIRED',
        message: `Template ${t.slug}: notes must be non-empty (when to use)`,
        path: `/templates/${t.slug}`,
      })
    }

    const tokens = listCurlyTokens(joined)
    const minTokens = t.channel === 'linkedin' && t.length === 'ultra_short' ? 1 : 2
    if (tokens.length < minTokens) {
      failures.push({
        code: 'TEMPLATE_MIN_TOKENS',
        message: `Template ${t.slug}: expected >= ${minTokens} tokens, got ${tokens.length}`,
        path: `/templates/${t.slug}`,
      })
    }

    if (t.channel === 'email') {
      if (!t.subject || t.subject.trim().length < 10) {
        failures.push({
          code: 'EMAIL_SUBJECT_MIN_LENGTH',
          message: `Template ${t.slug}: email subject must be >= 10 chars`,
          path: `/templates/${t.slug}`,
        })
      }
      if (t.body.trim().length < 450) {
        failures.push({
          code: 'EMAIL_BODY_MIN_LENGTH',
          message: `Template ${t.slug}: email body must be >= 450 chars`,
          path: `/templates/${t.slug}`,
        })
      }
      if (!hasCtaQuestion(t.body)) {
        failures.push({
          code: 'EMAIL_CTA_REQUIRED',
          message: `Template ${t.slug}: email must include a clear CTA question near the end`,
          path: `/templates/${t.slug}`,
        })
      }
    } else if (t.channel === 'linkedin') {
      const min = t.length === 'ultra_short' ? 90 : 140
      if (t.body.trim().length < min) {
        failures.push({
          code: 'DM_BODY_MIN_LENGTH',
          message: `Template ${t.slug}: DM body must be >= ${min} chars`,
          path: `/templates/${t.slug}`,
        })
      }
    } else if (t.channel === 'call') {
      if (t.body.trim().length < 140) {
        failures.push({
          code: 'CALL_BODY_MIN_LENGTH',
          message: `Template ${t.slug}: call opener must be >= 140 chars`,
          path: `/templates/${t.slug}`,
        })
      }
      if (!t.body.includes('?')) {
        failures.push({
          code: 'CALL_QUESTION_REQUIRED',
          message: `Template ${t.slug}: call opener must include a concrete question`,
          path: `/templates/${t.slug}`,
        })
      }
    }
  }

  // 3) Use-cases/playbooks quality gates
  if (USE_CASE_PLAYBOOKS.length < 6) {
    failures.push({
      code: 'PLAYBOOKS_MIN_COUNT',
      message: `Use-cases: expected 6 playbooks, got ${USE_CASE_PLAYBOOKS.length}`,
    })
  }
  for (const p of USE_CASE_PLAYBOOKS) {
    const joined = JSON.stringify(p)
    if (hasBracketTokens(joined)) {
      failures.push({
        code: 'PLAYBOOK_BRACKET_TOKENS',
        message: `Playbook ${p.slug}: contains bracket token characters [ or ]`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.whenWorksBest.length < 3) {
      failures.push({
        code: 'PLAYBOOK_WHEN_WORKS_BEST_MIN',
        message: `Playbook ${p.slug}: whenWorksBest must have >= 3 bullets`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.timingSignals.length < 6) {
      failures.push({
        code: 'PLAYBOOK_TIMING_SIGNALS_MIN',
        message: `Playbook ${p.slug}: timingSignals must have >= 6 bullets`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.angles.length < 8) {
      failures.push({
        code: 'PLAYBOOK_ANGLES_MIN',
        message: `Playbook ${p.slug}: angles must have >= 8 items`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.sequencePack.length !== 7) {
      failures.push({
        code: 'PLAYBOOK_SEQUENCE_PACK_COUNT',
        message: `Playbook ${p.slug}: sequencePack must have exactly 7 items`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.objections.length < 6) {
      failures.push({
        code: 'PLAYBOOK_OBJECTIONS_MIN',
        message: `Playbook ${p.slug}: objections must have >= 6 items`,
        path: `/use-cases/${p.slug}`,
      })
    }
    if (p.personalizationExamples.length < 2) {
      failures.push({
        code: 'PLAYBOOK_PERSONALIZATION_EXAMPLES_MIN',
        message: `Playbook ${p.slug}: personalizationExamples must have >= 2 items`,
        path: `/use-cases/${p.slug}`,
      })
    }

    for (const s of p.sequencePack) {
      const ok = TEMPLATE_LIBRARY.some((t) => t.slug === s.templateSlug)
      if (!ok) {
        failures.push({
          code: 'PLAYBOOK_SEQUENCE_TEMPLATE_MISSING',
          message: `Playbook ${p.slug}: sequence item references missing template slug: ${s.templateSlug}`,
          path: `/use-cases/${p.slug}`,
        })
      }
    }
  }

  // 4) Compare pages quality gates
  const requiredCompareSlugs = new Set([
    'leadintel-vs-apollo',
    'leadintel-vs-sales-navigator',
    'leadintel-vs-crunchbase',
    'leadintel-vs-google-alerts',
    'leadintel-vs-manual-research',
    'leadintel-vs-spreadsheets',
  ])
  for (const slug of requiredCompareSlugs) {
    if (!COMPARE_PAGES.some((p) => p.slug === slug)) {
      failures.push({ code: 'COMPARE_REQUIRED_SLUG_MISSING', message: `Compare pages missing required slug: ${slug}`, path: `/compare/${slug}` })
    }
  }
  for (const c of COMPARE_PAGES) {
    if (c.useTogether.length < 2) {
      failures.push({ code: 'COMPARE_USE_TOGETHER_MIN', message: `Compare ${c.slug}: useTogether must have >= 2 bullets`, path: `/compare/${c.slug}` })
    }
    if (c.checklist.length < 12) {
      failures.push({ code: 'COMPARE_CHECKLIST_MIN', message: `Compare ${c.slug}: checklist must have >= 12 questions`, path: `/compare/${c.slug}` })
    }
    if (c.migrationSteps.length < 4) {
      failures.push({ code: 'COMPARE_MIGRATION_STEPS_MIN', message: `Compare ${c.slug}: migrationSteps must have >= 4 steps`, path: `/compare/${c.slug}` })
    }
    if (c.faqs.length < 5) {
      failures.push({ code: 'COMPARE_FAQS_MIN', message: `Compare ${c.slug}: faqs must have >= 5 items`, path: `/compare/${c.slug}` })
    }
  }

  // 5) Forbidden phrase scanner (marketing/content scoped)
  const scopedDirs = [
    path.join(workspaceRoot, 'app', '(public)'),
    path.join(workspaceRoot, 'components', 'marketing'),
    path.join(workspaceRoot, 'lib', 'copy'),
    path.join(workspaceRoot, 'lib', 'compare'),
  ]
  const scopedFiles = scopedDirs.flatMap((d) => listFiles(d, ['.ts', '.tsx', '.md']))
  for (const f of scopedFiles) {
    const t = readText(f)
    for (const re of FORBIDDEN) {
      if (re.test(t)) {
        failures.push({
          code: 'FORBIDDEN_PHRASE',
          message: `Forbidden phrase (${re.source}) found in ${path.relative(workspaceRoot, f)}`,
          path: path.relative(workspaceRoot, f),
        })
        break
      }
    }
  }

  const status: ContentAuditStatus = failures.length > 0 ? 'error' : 'ok'
  if (failures.length > 0) return { ok: false, status, failures }
  return {
    ok: true,
    status,
    failures: [],
    summary: {
      routesChecked: REQUIRED_ROUTES.length,
      templates: TEMPLATE_LIBRARY.length,
      playbooks: USE_CASE_PLAYBOOKS.length,
      comparePages: COMPARE_PAGES.length,
      scannedFiles: scopedFiles.length,
    },
  }
}

export async function runContentAudit(args: { dryRun?: boolean }) {
  const createdAtIso = new Date().toISOString()
  let res: AuditResult
  try {
    res = auditContent(process.cwd())
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error'
    res = {
      ok: false,
      status: 'error',
      failures: [{ code: 'CONTENT_AUDIT_EXCEPTION', message }],
    }
  }

  const status: ContentAuditStatus = res.status
  const failures = res.failures
  const summaryObj = res.ok ? res.summary : (res.summary ?? {})

  const summary = res.ok
    ? `ok: routes=${String(summaryObj.routesChecked ?? '?')}, templates=${String(summaryObj.templates ?? '?')}, playbooks=${String(
        summaryObj.playbooks ?? '?'
      )}, compares=${String(summaryObj.comparePages ?? '?')}, scannedFiles=${String(summaryObj.scannedFiles ?? '?')}`
    : `error: failures=${failures.length}`

  // Persist best-effort (service-role only). Never fail the job for persistence.
  if (!args.dryRun) {
    try {
      const supabase = createSupabaseAdminClient({ schema: 'api' })
      await supabase.from('content_audit_reports').insert({
        created_at: createdAtIso,
        status,
        failures,
        summary,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'persist_failed'
      failures.push({ code: 'PERSIST_FAILED', message: `Failed to persist report: ${msg}` })
    }
  }

  return {
    status: status === 'ok' ? ('ok' as const) : ('error' as const),
    summary: {
      ok: true,
      status,
      summary,
      failuresCount: failures.length,
      ...(failures.length > 0 ? { failures } : {}),
    },
  }
}

