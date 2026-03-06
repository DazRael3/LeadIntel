import fs from 'fs'
import path from 'path'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import { USE_CASE_PLAYBOOKS } from '@/lib/use-cases/playbooks'
import { COMPARE_PAGES } from '@/lib/compare/registry'

type AuditResult = { ok: true; summary: Record<string, unknown> } | { ok: false; failures: string[] }

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
  return text.includes('[') || text.includes(']')
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
  const failures: string[] = []

  // 1) Sitemap required routes
  const sitemapPath = path.join(workspaceRoot, 'app', 'sitemap.ts')
  const sitemapText = fs.existsSync(sitemapPath) ? readText(sitemapPath) : ''
  for (const r of REQUIRED_ROUTES) {
    if (!sitemapText.includes(`'${r}'`) && !sitemapText.includes(`"${r}"`)) {
      failures.push(`sitemap missing route: ${r}`)
    }
  }

  // 2) Templates quality gates (registry-driven)
  if (TEMPLATE_LIBRARY.length < 60) failures.push(`templates: expected >= 60, got ${TEMPLATE_LIBRARY.length}`)

  for (const t of TEMPLATE_LIBRARY) {
    const joined = `${t.subject ?? ''}\n${t.body}\n${t.notes}`
    if (hasBracketTokens(joined)) failures.push(`template ${t.slug}: contains bracket token characters [ or ]`)
    if (!t.notes || t.notes.trim().length < 20) failures.push(`template ${t.slug}: notes must be non-empty (when to use)`)

    const tokens = listCurlyTokens(joined)
    const minTokens = t.channel === 'linkedin' && t.length === 'ultra_short' ? 1 : 2
    if (tokens.length < minTokens) failures.push(`template ${t.slug}: expected >= ${minTokens} tokens, got ${tokens.length}`)

    if (t.channel === 'email') {
      if (!t.subject || t.subject.trim().length < 10) failures.push(`template ${t.slug}: email subject must be >= 10 chars`)
      if (t.body.trim().length < 450) failures.push(`template ${t.slug}: email body must be >= 450 chars`)
      if (!hasCtaQuestion(t.body)) failures.push(`template ${t.slug}: email must include a clear CTA question near the end`)
    } else if (t.channel === 'linkedin') {
      const min = t.length === 'ultra_short' ? 90 : 140
      if (t.body.trim().length < min) failures.push(`template ${t.slug}: DM body must be >= ${min} chars`)
    } else if (t.channel === 'call') {
      if (t.body.trim().length < 140) failures.push(`template ${t.slug}: call opener must be >= 140 chars`)
      if (!t.body.includes('?')) failures.push(`template ${t.slug}: call opener must include a concrete question`)
    }
  }

  // 3) Use-cases/playbooks quality gates
  if (USE_CASE_PLAYBOOKS.length < 6) failures.push(`use-cases: expected 6 playbooks, got ${USE_CASE_PLAYBOOKS.length}`)
  for (const p of USE_CASE_PLAYBOOKS) {
    const joined = JSON.stringify(p)
    if (hasBracketTokens(joined)) failures.push(`playbook ${p.slug}: contains bracket token characters [ or ]`)
    if (p.whenWorksBest.length < 3) failures.push(`playbook ${p.slug}: whenWorksBest must have >= 3 bullets`)
    if (p.timingSignals.length < 6) failures.push(`playbook ${p.slug}: timingSignals must have >= 6 bullets`)
    if (p.angles.length < 8) failures.push(`playbook ${p.slug}: angles must have >= 8 items`)
    if (p.sequencePack.length !== 7) failures.push(`playbook ${p.slug}: sequencePack must have exactly 7 items`)
    if (p.objections.length < 6) failures.push(`playbook ${p.slug}: objections must have >= 6 items`)
    if (p.personalizationExamples.length < 2) failures.push(`playbook ${p.slug}: personalizationExamples must have >= 2 items`)

    for (const s of p.sequencePack) {
      const ok = TEMPLATE_LIBRARY.some((t) => t.slug === s.templateSlug)
      if (!ok) failures.push(`playbook ${p.slug}: sequence item references missing template slug: ${s.templateSlug}`)
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
    if (!COMPARE_PAGES.some((p) => p.slug === slug)) failures.push(`compare pages missing required slug: ${slug}`)
  }
  for (const c of COMPARE_PAGES) {
    if (c.useTogether.length < 2) failures.push(`compare ${c.slug}: useTogether must have >= 2 bullets`)
    if (c.checklist.length < 12) failures.push(`compare ${c.slug}: checklist must have >= 12 questions`)
    if (c.migrationSteps.length < 4) failures.push(`compare ${c.slug}: migrationSteps must have >= 4 steps`)
    if (c.faqs.length < 5) failures.push(`compare ${c.slug}: faqs must have >= 5 items`)
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
        failures.push(`forbidden phrase (${re.source}) found in ${path.relative(workspaceRoot, f)}`)
        break
      }
    }
  }

  if (failures.length > 0) return { ok: false, failures }
  return {
    ok: true,
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
  const res = auditContent(process.cwd())
  if (!res.ok) return { status: 'error' as const, summary: { failures: res.failures } }
  return { status: 'ok' as const, summary: res.summary }
}

