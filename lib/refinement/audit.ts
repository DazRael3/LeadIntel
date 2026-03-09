import { COPY } from '@/lib/copy/leadintel'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'
import { VERTICAL_LIST } from '@/lib/verticals/registry'
import { VERTICAL_USE_CASES } from '@/lib/verticals/use-cases'
import { REFINEMENT_GAP_CATEGORIES, type RefinementGapCategoryKey } from './gap-categories'

export type RefinementAuditStatus = 'ok' | 'warn' | 'needs_attention'

export type RefinementFinding = {
  category: RefinementGapCategoryKey
  status: RefinementAuditStatus
  title: string
  detail: string
  evidence?: { key: string; value: string }[]
  suggestedNextSteps: string[]
}

export type RefinementAuditReport = {
  generatedAt: string
  summary: {
    ok: number
    warn: number
    needsAttention: number
  }
  findings: RefinementFinding[]
}

function summarize(findings: RefinementFinding[]): RefinementAuditReport['summary'] {
  let ok = 0
  let warn = 0
  let needsAttention = 0
  for (const f of findings) {
    if (f.status === 'ok') ok++
    else if (f.status === 'warn') warn++
    else needsAttention++
  }
  return { ok, warn, needsAttention }
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

function statusFromCounts(args: { ok: boolean; warn?: boolean }): RefinementAuditStatus {
  if (args.ok) return 'ok'
  if (args.warn) return 'warn'
  return 'needs_attention'
}

export function auditRefinement(): RefinementAuditReport {
  const now = new Date().toISOString()

  const findings: RefinementFinding[] = []

  // Templates: registry health (real, deterministic)
  const templatesCount = TEMPLATE_LIBRARY.length
  const has60 = templatesCount >= 60
  findings.push({
    category: 'vertical_use_case_copy_gaps',
    status: statusFromCounts({ ok: VERTICAL_LIST.length >= 3, warn: VERTICAL_LIST.length >= 1 }),
    title: 'Verticalization registry present (bounded)',
    detail:
      VERTICAL_LIST.length >= 3
        ? 'A bounded vertical registry exists and can drive “best fit” messaging without claiming deep industry specialization.'
        : 'Vertical registry is missing or too small to drive consistent messaging.',
    evidence: [
      { key: 'verticals', value: String(VERTICAL_LIST.length) },
      { key: 'use_cases', value: String(Object.keys(VERTICAL_USE_CASES).length) },
    ],
    suggestedNextSteps: uniq([
      'Use the registry to power curated discovery rails (templates and use-cases).',
      'Keep support levels explicit (supported vs vertical-friendly).',
    ]),
  })

  findings.push({
    category: 'table_filter_consistency',
    status: statusFromCounts({ ok: has60, warn: templatesCount >= 45 }),
    title: 'Template library inventory',
    detail: has60 ? 'Template library meets the 60+ inventory bar.' : 'Template inventory is below the 60+ inventory bar.',
    evidence: [{ key: 'templates', value: String(templatesCount) }],
    suggestedNextSteps: uniq([
      has60 ? 'Maintain template quality gates in content audit.' : 'Expand templates inventory while preserving quality rules and token standards.',
      'Keep template metadata consistent: trigger/channel/length/notes/tokens.',
    ]),
  })

  // Copy system: ensure key state copy is centralized
  const hasStates =
    Boolean(COPY.states?.empty?.noIcp?.title) &&
    Boolean(COPY.states?.empty?.noAccounts?.title) &&
    Boolean(COPY.errors?.requestFailed?.title)
  findings.push({
    category: 'copy_inconsistency',
    status: statusFromCounts({ ok: hasStates, warn: Boolean(COPY.states?.empty?.noIcp?.title) }),
    title: 'Central copy system coverage',
    detail: hasStates
      ? 'Core empty/error copy is centralized in the shared copy module.'
      : 'Some core empty/error copy is not centralized, risking inconsistency.',
    suggestedNextSteps: uniq([
      'Use shared copy for empty/loading/error/locked states in high-traffic surfaces.',
      'Add a short language guide that maps terms to real platform objects.',
    ]),
  })

  // Gating clarity: copy + surfaces should be explicit about plan/preview
  findings.push({
    category: 'permission_gating_confusion',
    status: 'warn',
    title: 'Preview vs saved output clarity',
    detail:
      'Ensure “preview” vs “saved report” vs “pitch draft” terminology stays consistent, especially when free usage is shared across pitches and reports.',
    suggestedNextSteps: uniq([
      'Keep “preview locked on Free” headers consistent across pitch/report surfaces.',
      'Ensure reports lists include only true reports; show cross-surface “Recent premium activity” separately.',
    ]),
  })

  // Route continuity: focused, non-theatrical reminder
  findings.push({
    category: 'route_continuity',
    status: 'warn',
    title: 'Workflow continuity checks',
    detail: 'After generation/export/approval actions, users should get a clear “what happened / what next” state without duplicated banners.',
    suggestedNextSteps: uniq([
      'Use consistent toast + inline confirmation patterns.',
      'Provide direct next-step links (open report, open pitch, view templates, upgrade).',
    ]),
  })

  // Ensure every category is represented at least once (keeps the board structured)
  const covered = new Set(findings.map((f) => f.category))
  for (const c of REFINEMENT_GAP_CATEGORIES) {
    if (covered.has(c.key)) continue
    findings.push({
      category: c.key,
      status: 'warn',
      title: c.label,
      detail: c.intent,
      suggestedNextSteps: ['Capture concrete instances as bug-bash items and close them with small, targeted patches.'],
    })
  }

  return { generatedAt: now, summary: summarize(findings), findings }
}

