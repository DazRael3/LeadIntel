import fs from 'fs'
import path from 'path'

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

  // 2) Playbooks completeness (simple structural check)
  const useCasesDir = path.join(workspaceRoot, 'app', '(public)', 'use-cases')
  const useCasePages = listFiles(useCasesDir, ['page.tsx'])
  for (const p of useCasePages) {
    const t = readText(p)
    if (!t.includes('PlaybookTemplate')) continue
    const must = ['cold1', 'cold2', 'cold3', 'dm1', 'dm2', 'call1', 'call2']
    const missing = must.filter((k) => !t.includes(`${k}:`))
    if (missing.length > 0) failures.push(`playbook incomplete (${path.relative(workspaceRoot, p)}): missing ${missing.join(', ')}`)
  }

  // Bottom CTA module should exist in the template component (not per-page).
  const playbookTemplatePath = path.join(workspaceRoot, 'components', 'marketing', 'PlaybookTemplate.tsx')
  if (fs.existsSync(playbookTemplatePath)) {
    const tpl = readText(playbookTemplatePath)
    const hasCta =
      tpl.includes('Generate a tailored pitch in LeadIntel') &&
      tpl.includes('Try a sample digest') &&
      tpl.includes('See pricing')
    if (!hasCta) failures.push('PlaybookTemplate missing bottom CTA module copy/buttons')
  } else {
    failures.push('PlaybookTemplate missing: components/marketing/PlaybookTemplate.tsx')
  }

  // 3) Forbidden phrase scanner (marketing/content scoped)
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
  return { ok: true, summary: { routesChecked: REQUIRED_ROUTES.length, useCasePages: useCasePages.length, scannedFiles: scopedFiles.length } }
}

export async function runContentAudit(args: { dryRun?: boolean }) {
  const res = auditContent(process.cwd())
  if (!res.ok) return { status: 'error' as const, summary: { failures: res.failures } }
  return { status: 'ok' as const, summary: res.summary }
}

