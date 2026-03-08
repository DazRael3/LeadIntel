import OpenAI from 'openai'
import { serverEnv } from '@/lib/env'
import { isE2E, isTestEnv } from '@/lib/runtimeFlags'
import type { NormalizedCitation } from '@/lib/sources/normalize'
import type { SourcesBundle } from '@/lib/sources/orchestrate'
import { normalizeCitations } from '@/lib/sources/normalize'

export type CompetitiveReportUserContext = {
  whatYouSell: string | null
  idealCustomer: string | null
}

export type CompetitiveReportGenerationInput = {
  companyName: string
  companyDomain: string | null
  inputUrl: string | null
  fetchedAt: string
  sources: SourcesBundle
  userContext: CompetitiveReportUserContext
  internalSignals: Array<{ headline: string; detectedAt: string | null; sourceUrl: string; summary: string | null }>
}

type ModelBullet = { text: string; claimType: 'fact' | 'hypothesis'; citations: string[] }
type ModelSection = { heading: string; bullets: ModelBullet[] }

type ModelOutput = {
  executiveSummary: string
  sections: ModelSection[]
  usedCitations: string[]
}

export type CompetitiveReportSourcedResult = {
  reportMarkdown: string
  sourcesUsed: NormalizedCitation[]
  reportJson: { sections: ModelSection[]; executiveSummary: string }
  model: string
}

function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY })
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function withoutSelfLinks(text: string): string {
  return text.replace(/https?:\/\/dazrael\.com\/competitive-report\S*/gi, '').trim()
}

function citationIndex(citations: NormalizedCitation[]): Map<string, number> {
  const m = new Map<string, number>()
  let i = 1
  for (const c of citations) {
    if (!c.url) continue
    const key = c.url.toLowerCase()
    if (m.has(key)) continue
    m.set(key, i++)
  }
  return m
}

function renderSourcesAndFreshness(args: { fetchedAt: string; citations: NormalizedCitation[] }): string {
  const byType = new Map<string, NormalizedCitation[]>()
  for (const c of args.citations) {
    const t = c.type ?? 'source'
    const arr = byType.get(t) ?? []
    arr.push(c)
    byType.set(t, arr)
  }
  const blocks: string[] = []
  blocks.push('## Sources & Freshness')
  blocks.push(`Last refreshed: ${args.fetchedAt}`)
  blocks.push('')
  const types = Array.from(byType.keys()).sort()
  if (types.length === 0) {
    blocks.push('No sources are available yet. Refresh sources to fetch the latest signals.')
    blocks.push('')
    return blocks.join('\n')
  }
  for (const t of types) {
    blocks.push(`### ${t.replace(/_/g, ' ')}`)
    const items = (byType.get(t) ?? []).slice(0, 15)
    for (const c of items) {
      const title = c.title ? ` — ${c.title}` : ''
      const when = c.publishedAt ? ` (${c.publishedAt})` : ''
      blocks.push(`- ${c.url}${when}${title}`)
    }
    blocks.push('')
  }
  return blocks.join('\n')
}

function normalizeUrlList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    const s = safeTrim(x)
    if (!s) continue
    try {
      // eslint-disable-next-line no-new -- validation only
      new URL(s)
      out.push(s)
    } catch {
      // ignore
    }
    if (out.length >= 50) break
  }
  return out
}

function compileAvailableCitations(input: CompetitiveReportGenerationInput): NormalizedCitation[] {
  const sourceCitations = input.sources.allCitations ?? []
  const internal = input.internalSignals.map((s) => ({
    url: s.sourceUrl,
    title: s.headline,
    publishedAt: s.detectedAt ?? undefined,
    source: 'LeadIntel',
    type: 'internal_signal',
  }))
  return normalizeCitations([...sourceCitations, ...internal])
}

function buildVerifiableFacts(input: CompetitiveReportGenerationInput): Array<{ text: string; citations: string[] }> {
  const facts: Array<{ text: string; citations: string[] }> = []

  // Hiring facts from Greenhouse/Lever payloads (verifiable via ATS API URL citation)
  for (const sourceType of ['greenhouse', 'lever'] as const) {
    const s = input.sources.sources[sourceType]
    if (!s || s.status !== 'ok') continue
    const payload = (s.payload ?? {}) as { totalOpenRoles?: unknown; byDepartment?: unknown; boardUrl?: unknown; careersUrl?: unknown }
    const total = typeof payload.totalOpenRoles === 'number' ? payload.totalOpenRoles : null
    const careersUrl = typeof payload.careersUrl === 'string' ? payload.careersUrl : null
    const apiCitation = (s.citations ?? []).find((c) => c.type === 'ats_api')?.url ?? null
    const cites = [apiCitation, careersUrl].filter((x): x is string => typeof x === 'string' && x.length > 0)
    if (typeof total === 'number' && cites.length > 0) {
      facts.push({ text: `Hiring signal: ${total} open roles listed via ${sourceType.toUpperCase()}.`, citations: cites })
    }
  }

  // SEC facts (verifiable via SEC submissions + filing URLs)
  {
    const s = input.sources.sources.sec
    if (s && s.status === 'ok') {
      const payload = (s.payload ?? {}) as { matched?: { ticker?: unknown; cik?: unknown }; filings?: unknown }
      const ticker = typeof payload.matched?.ticker === 'string' ? payload.matched.ticker : null
      const filings = Array.isArray(payload.filings) ? payload.filings : []
      const cites = (s.citations ?? []).map((c) => c.url).filter(Boolean)
      if (ticker && filings.length > 0 && cites.length > 0) {
        facts.push({ text: `SEC signal: recent filings available for ${ticker}.`, citations: cites.slice(0, 3) })
      }
    }
  }

  // News facts (verifiable by article URLs)
  {
    const s = input.sources.sources.gdelt
    if (s && s.status === 'ok') {
      const payload = (s.payload ?? {}) as { articles?: unknown }
      const articles = Array.isArray(payload.articles) ? payload.articles : []
      const urls = articles
        .map((a) => (a && typeof a === 'object' && 'url' in a ? String((a as { url?: unknown }).url ?? '') : ''))
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http'))
      const cites = urls.slice(0, 3)
      if (cites.length > 0) {
        facts.push({ text: `News signal: recent mentions detected in the last 7 days.`, citations: cites })
      }
    }
  }

  // Internal signals (trigger_events) are already verifiable via their source URLs.
  for (const s of input.internalSignals.slice(0, 5)) {
    facts.push({
      text: `Internal signal: ${s.headline}${s.detectedAt ? ` (${s.detectedAt.slice(0, 10)})` : ''}.`,
      citations: [s.sourceUrl],
    })
  }

  return facts.slice(0, 20)
}

function markdownFromModel(args: {
  companyName: string
  fetchedAt: string
  executiveSummary: string
  sections: ModelSection[]
  citations: NormalizedCitation[]
  used: NormalizedCitation[]
}): string {
  const idx = citationIndex(args.citations)

  const formatBullet = (b: ModelBullet): string => {
    const urls = b.citations ?? []
    const nums = urls
      .map((u) => idx.get(u.toLowerCase()))
      .filter((n): n is number => typeof n === 'number')
      .slice(0, 3)
    const citeSuffix = nums.length > 0 ? ` [${nums.map((n) => `[${n}]`).join(' ')}]` : ''
    const prefix = b.claimType === 'hypothesis' ? 'Hypothesis: ' : ''
    return `- ${prefix}${withoutSelfLinks(b.text)}${citeSuffix}`.trim()
  }

  const requiredHeadings = new Set([
    'Market context & positioning',
    'Competitor map',
    'Differentiators & vulnerabilities',
    'Buying triggers & “why now” angles',
    'Recommended outreach angles (5)',
    'Objection handling (5)',
    'Suggested 7-touch sequence (email + linkedin + call openers)',
    'Next steps checklist',
    'Verification checklist (to avoid guessing)',
  ])

  const byHeading = new Map(args.sections.map((s) => [s.heading, s]))
  const ordered: Array<{ heading: string; bullets: ModelBullet[] }> = []
  for (const h of requiredHeadings) {
    const sec = byHeading.get(h)
    ordered.push({ heading: h, bullets: sec?.bullets ?? [] })
  }

  const blocks: string[] = []
  blocks.push(`# Competitive Intelligence Report: ${withoutSelfLinks(args.companyName)}`)
  blocks.push('')
  blocks.push(renderSourcesAndFreshness({ fetchedAt: args.fetchedAt, citations: args.used }))
  blocks.push('')
  blocks.push('## Executive summary')
  blocks.push(withoutSelfLinks(args.executiveSummary))
  blocks.push('')

  for (const s of ordered) {
    blocks.push(`## ${s.heading}`)
    if (!s.bullets || s.bullets.length === 0) {
      blocks.push('- Hypothesis: No sourced items available yet. Use the verification checklist below to confirm specifics.')
      blocks.push('')
      continue
    }
    for (const b of s.bullets.slice(0, 10)) {
      blocks.push(formatBullet(b))
    }
    blocks.push('')
  }

  // References list for traceability
  blocks.push('## References')
  const usedIdx = citationIndex(args.used)
  const usedSorted = [...args.used].sort((a, b) => (usedIdx.get(a.url.toLowerCase()) ?? 0) - (usedIdx.get(b.url.toLowerCase()) ?? 0))
  for (const c of usedSorted) {
    const n = usedIdx.get(c.url.toLowerCase())
    if (!n) continue
    const title = c.title ? ` — ${c.title}` : ''
    const when = c.publishedAt ? ` (${c.publishedAt})` : ''
    blocks.push(`[${n}] ${c.url}${when}${title}`)
  }
  blocks.push('')
  return blocks.join('\n').replace(/https?:\/\/dazrael\.com\/competitive-report\S*/gi, '').trim() + '\n'
}

export async function generateCompetitiveIntelligenceReportSourced(
  input: CompetitiveReportGenerationInput
): Promise<CompetitiveReportSourcedResult> {
  const model = 'gpt-4o'
  const availableCitations = compileAvailableCitations(input)
  const facts = buildVerifiableFacts(input)

  if (isE2E() || isTestEnv()) {
    const used = availableCitations.slice(0, 5)
    const sections: ModelSection[] = [
      { heading: 'Market context & positioning', bullets: [{ text: 'Map the company to one primary job-to-be-done and validate on first-party pages.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Competitor map', bullets: [{ text: 'List 3 direct alternatives mentioned on the company site or review pages (verify).', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Differentiators & vulnerabilities', bullets: [{ text: 'Differentiate on speed-to-value and implementation risk; validate with references.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Buying triggers & “why now” angles', bullets: [{ text: 'Use verified signals when present; otherwise form hypotheses and verify.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Recommended outreach angles (5)', bullets: [{ text: 'Lead with a measurable workflow outcome and a narrow pilot.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Objection handling (5)', bullets: [{ text: '“Already have a tool” → Position as complementary, propose a pilot.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Suggested 7-touch sequence (email + linkedin + call openers)', bullets: [{ text: 'Email 1: hypothesis + one question (no claims).', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Next steps checklist', bullets: [{ text: 'Verify category, buyer, and alternatives using the checklist.', claimType: 'hypothesis', citations: [] }] },
      { heading: 'Verification checklist (to avoid guessing)', bullets: [{ text: 'Check pricing, careers, press/blog, review sites, and LinkedIn posts.', claimType: 'hypothesis', citations: [] }] },
    ]
    const md = markdownFromModel({
      companyName: input.companyName,
      fetchedAt: input.fetchedAt,
      executiveSummary:
        'Framework-based report (test mode). Any factual claims must be backed by citations; otherwise treat as hypotheses and verify.',
      sections,
      citations: availableCitations,
      used,
    })
    return { reportMarkdown: md, sourcesUsed: used, reportJson: { sections, executiveSummary: 'Framework-based report.' }, model }
  }

  const openai = getOpenAIClient()

  const allowedUrls = availableCitations.map((c) => c.url)
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.35,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You generate competitive intelligence reports for B2B sellers.',
          'Hard rules:',
          '- Do NOT invent factual claims about the company. Any factual claim must cite at least one URL from Allowed citations.',
          '- If you do not have a citation, mark the claimType as "hypothesis" and phrase it as a hypothesis or "needs verification".',
          '- Do NOT include any CTA linking to /competitive-report or dazrael.com/competitive-report.',
          '- No bracket placeholders like [COMPANY] or [NAME].',
          '',
          'Output JSON format:',
          '{',
          '  "executiveSummary": "string",',
          '  "sections": [',
          '    { "heading": "Market context & positioning", "bullets": [ { "text":"...", "claimType":"fact|hypothesis", "citations":["https://..."] } ] },',
          '    { "heading": "Competitor map", ... },',
          '    { "heading": "Differentiators & vulnerabilities", ... },',
          '    { "heading": "Buying triggers & “why now” angles", ... },',
          '    { "heading": "Recommended outreach angles (5)", ... },',
          '    { "heading": "Objection handling (5)", ... },',
          '    { "heading": "Suggested 7-touch sequence (email + linkedin + call openers)", ... },',
          '    { "heading": "Next steps checklist", ... },',
          '    { "heading": "Verification checklist (to avoid guessing)", ... }',
          '  ],',
          '  "usedCitations": ["https://..."]',
          '}',
          '',
          'Constraints:',
          '- For headings "Recommended outreach angles (5)" and "Objection handling (5)", output exactly 5 bullets each.',
          '- For "Suggested 7-touch sequence...", output exactly 7 bullets and include channel labels (Email/LinkedIn/Call).',
          '- usedCitations MUST be a subset of Allowed citations.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Company: ${input.companyName}`,
          input.companyDomain ? `Domain: ${input.companyDomain}` : 'Domain: (not provided)',
          input.inputUrl ? `Input URL: ${input.inputUrl}` : 'Input URL: (not provided)',
          '',
          'Seller context (optional):',
          input.userContext.whatYouSell ? `- What we sell: ${input.userContext.whatYouSell}` : '- What we sell: (not provided)',
          input.userContext.idealCustomer ? `- Ideal customer: ${input.userContext.idealCustomer}` : '- Ideal customer: (not provided)',
          '',
          'Verifiable facts (each includes citations you may use for factual claims):',
          facts.length > 0 ? facts.map((f) => `- ${f.text}\n  citations: ${f.citations.join(', ')}`).join('\n') : '- (none)',
          '',
          'Allowed citations (only these URLs are permitted):',
          allowedUrls.length > 0 ? allowedUrls.map((u) => `- ${u}`).join('\n') : '- (none)',
          '',
          'Generate the report sections now.',
        ].join('\n'),
      },
    ],
  })

  const content = response.choices?.[0]?.message?.content?.trim() || ''
  if (!content) throw new Error('competitive_report_empty_response')
  const parsed = JSON.parse(content) as ModelOutput

  const executiveSummary = withoutSelfLinks(safeTrim(parsed.executiveSummary) || 'Framework-based summary with explicit verification steps.')
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : []

  // Enforce citations + claimType integrity.
  const allowedSet = new Set(allowedUrls.map((u) => u.toLowerCase()))
  const sanitizedSections: ModelSection[] = rawSections
    .map((s) => {
      const heading = safeTrim((s as ModelSection).heading)
      const bulletsRaw = Array.isArray((s as ModelSection).bullets) ? (s as ModelSection).bullets : []
      const bullets: ModelBullet[] = bulletsRaw
        .map((b) => {
          const text = withoutSelfLinks(safeTrim((b as ModelBullet).text))
          const claimType: ModelBullet['claimType'] = (b as ModelBullet).claimType === 'fact' ? 'fact' : 'hypothesis'
          const citations = normalizeUrlList((b as ModelBullet).citations).filter((u) => allowedSet.has(u.toLowerCase()))
          const effectiveClaimType: ModelBullet['claimType'] =
            claimType === 'fact' && citations.length === 0 ? 'hypothesis' : claimType
          return { text, claimType: effectiveClaimType, citations }
        })
        .filter((b) => b.text.length > 0)
      return { heading, bullets }
    })
    .filter((s) => s.heading.length > 0)

  const usedUrls = normalizeUrlList(parsed.usedCitations).filter((u) => allowedSet.has(u.toLowerCase()))
  const used = normalizeCitations(availableCitations.filter((c) => usedUrls.some((u) => u.toLowerCase() === c.url.toLowerCase())))
  const usedNonEmpty = used.length > 0 ? used : availableCitations.slice(0, 15)

  const markdown = markdownFromModel({
    companyName: input.companyName,
    fetchedAt: input.fetchedAt,
    executiveSummary,
    sections: sanitizedSections,
    citations: availableCitations,
    used: usedNonEmpty,
  })

  return {
    reportMarkdown: markdown,
    sourcesUsed: usedNonEmpty,
    reportJson: { sections: sanitizedSections, executiveSummary },
    model,
  }
}

