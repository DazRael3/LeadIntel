import { isE2E, isTestEnv } from '@/lib/runtimeFlags'
import { generateWithProviderRouter } from '@/lib/ai/providerRouter'

export type VerifiedSignal = {
  headline: string
  eventType: string | null
  detectedAt: string | null
  sourceUrl: string | null
  description: string | null
}

export type CompetitiveReportGenerateInput = {
  companyName: string
  companyDomain: string | null
  inputUrl: string | null
  userContext: {
    whatYouSell: string | null
    idealCustomer: string | null
  }
  verifiedSignals: VerifiedSignal[]
}

export type CompetitiveReportSection =
  | { key: 'executive_summary'; title: 'Executive summary'; content: string }
  | { key: 'market_context'; title: 'Market context & positioning'; bullets: string[] }
  | { key: 'competitor_map'; title: 'Competitor map'; bullets: string[] }
  | { key: 'differentiators'; title: 'Differentiators & vulnerabilities'; bullets: string[] }
  | { key: 'buying_triggers'; title: 'Buying triggers & “why now” angles'; bullets: string[] }
  | { key: 'outreach_angles'; title: 'Recommended outreach angles (5)'; bullets: string[] }
  | { key: 'objection_handling'; title: 'Objection handling (5)'; bullets: string[] }
  | { key: 'sequence'; title: 'Suggested 7-touch sequence (email + linkedin + call openers)'; bullets: string[] }
  | { key: 'next_steps'; title: 'Next steps checklist'; bullets: string[] }
  | { key: 'verification_checklist'; title: 'Verification checklist (to avoid guessing)'; bullets: string[] }

export type CompetitiveReportGenerateResult = {
  reportMarkdown: string
  reportJson: { sections: CompetitiveReportSection[] }
  model: string
}

function toBullets(lines: unknown, max: number): string[] {
  if (!Array.isArray(lines)) return []
  return lines
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0)
    .slice(0, max)
}

function ensureNoBracketTokens(text: string): string {
  return text.replace(/\[[a-z0-9_]{2,40}\]/gi, '').trim()
}

function formatBullets(bullets: string[]): string {
  return bullets.map((b) => `- ${ensureNoBracketTokens(b)}`).join('\n')
}

function padToLength(value: string[], target: number, defaults: string[]): string[] {
  const out = value.slice(0, target)
  for (const d of defaults) {
    if (out.length >= target) break
    if (!out.includes(d)) out.push(d)
  }
  return out.slice(0, target)
}

function buildFallbackReport(input: CompetitiveReportGenerateInput): CompetitiveReportGenerateResult {
  const sections: CompetitiveReportSection[] = [
    {
      key: 'executive_summary',
      title: 'Executive summary',
      content:
        'Framework-based competitive report fallback. It avoids unsupported factual claims and focuses on a practical execution plan.',
    },
    {
      key: 'market_context',
      title: 'Market context & positioning',
      bullets: [
        'Positioning hypothesis: map the company to one primary job-to-be-done and validate using first-party pages.',
        'Category pressure: buyers compare suite vs best-of-breed vs internal build; align narrative to that decision.',
        'Procurement risk: anticipate implementation and security concerns early in outreach.',
      ],
    },
    {
      key: 'competitor_map',
      title: 'Competitor map',
      bullets: [
        'Direct alternatives (verify): gather named alternatives from company materials.',
        'Adjacent tooling: list systems they likely integrate with or replace.',
        'Internal status quo: account for manual workflows and incumbent tools.',
      ],
    },
    {
      key: 'differentiators',
      title: 'Differentiators & vulnerabilities',
      bullets: [
        'Differentiate on one measurable axis (speed, coverage, or execution quality).',
        'Address likely vulnerability areas up front with clear verification steps.',
      ],
    },
    {
      key: 'buying_triggers',
      title: 'Buying triggers & “why now” angles',
      bullets:
        input.verifiedSignals.length > 0
          ? input.verifiedSignals.slice(0, 5).map((signal) => `Verified signal: ${signal.headline}`)
          : ['Use timing-based hypotheses and validate before making factual claims.'],
    },
    {
      key: 'outreach_angles',
      title: 'Recommended outreach angles (5)',
      bullets: [
        'Reduce time spent on low-priority prospects with a repeatable qualification workflow.',
        'Improve handoff quality by standardizing how context is captured per account.',
        'Run a narrow pilot focused on one measurable conversion milestone.',
        'Tie recommendations to role-specific outcomes and current initiatives.',
        'Position adoption as low-risk with phased rollout and clear ownership.',
      ],
    },
    {
      key: 'objection_handling',
      title: 'Objection handling (5)',
      bullets: [
        '“We already have a tool.” → Position as complementary and propose a narrow pilot.',
        '“Not a priority right now.” → Tie to one KPI and confirm baseline.',
        '“Send details.” → Send a concise brief and one qualifying question.',
        '“Not my area.” → Ask for workflow owner and success criteria.',
        '“Timing is off.” → Offer a light re-check trigger and practical checklist.',
      ],
    },
    {
      key: 'sequence',
      title: 'Suggested 7-touch sequence (email + linkedin + call openers)',
      bullets: [
        'Email 1: hypothesis + one question.',
        'LinkedIn 1: concise context + reply prompt.',
        'Call 1: permission-based opener and role confirmation.',
        'Email 2: workflow insight + low-friction CTA.',
        'LinkedIn 2: one tactical checklist item.',
        'Call 2: confirm priority and propose scoped pilot.',
        'Email 3: respectful close-the-loop note.',
      ],
    },
    {
      key: 'next_steps',
      title: 'Next steps checklist',
      bullets: [
        'Validate buyer and category on first-party pages.',
        'Collect 3 competitor references from public materials.',
        'Draft a 7-day pilot with explicit success metrics.',
      ],
    },
    {
      key: 'verification_checklist',
      title: 'Verification checklist (to avoid guessing)',
      bullets: [
        'Homepage/product pages',
        'Pricing page',
        'Careers page',
        'Press/blog',
        'Review sites',
        'Recent LinkedIn posts',
      ],
    },
  ]

  return {
    reportMarkdown: renderReportMarkdown(input.companyName, sections),
    reportJson: { sections },
    model: 'deterministic-template-v1',
  }
}

export async function generateCompetitiveIntelligenceReport(
  input: CompetitiveReportGenerateInput
): Promise<CompetitiveReportGenerateResult> {
  if (isE2E() || isTestEnv()) {
    return buildFallbackReport(input)
  }

  const systemPrompt = [
    'You generate competitive intelligence reports for B2B sellers.',
    'Output strict JSON with keys:',
    'executive_summary, market_context, competitor_map, differentiators_vulnerabilities, buying_triggers, outreach_angles, objection_handling, suggested_sequence, next_steps, verification_checklist.',
    'No fabricated claims, no email format, and no placeholder tokens.',
  ].join('\n')

  const verifiedSignalsText =
    input.verifiedSignals.length > 0
      ? input.verifiedSignals
          .slice(0, 8)
          .map((signal) => `- ${signal.headline}`)
          .join('\n')
      : '- (none)'

  const userPrompt = [
    `Company name: ${input.companyName}`,
    input.companyDomain ? `Company domain: ${input.companyDomain}` : 'Company domain: (not provided)',
    input.inputUrl ? `Input URL: ${input.inputUrl}` : 'Input URL: (not provided)',
    '',
    'Seller context:',
    input.userContext.whatYouSell ? `- What we sell: ${input.userContext.whatYouSell}` : '- What we sell: (not provided)',
    input.userContext.idealCustomer ? `- Ideal customer: ${input.userContext.idealCustomer}` : '- Ideal customer: (not provided)',
    '',
    'Verified signals:',
    verifiedSignalsText,
  ].join('\n')

  const aiResult = await generateWithProviderRouter({
    task: 'account_research_summary',
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
    maxTokens: 1600,
    metadata: {
      route: '/lib/reports/competitive-report',
      companyDomain: input.companyDomain,
    },
  })

  if (!aiResult.ok) {
    return buildFallbackReport(input)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(aiResult.text) as Record<string, unknown>
  } catch {
    return buildFallbackReport(input)
  }

  const executiveSummaryRaw =
    typeof parsed.executive_summary === 'string' ? parsed.executive_summary.trim() : ''
  const executiveSummary = ensureNoBracketTokens(executiveSummaryRaw)

  const marketContext = toBullets(parsed.market_context, 12)
  const competitorMap = toBullets(parsed.competitor_map, 12)
  const differentiators = toBullets(parsed.differentiators_vulnerabilities, 14)
  const buyingTriggers = toBullets(parsed.buying_triggers, 12)

  const outreachAngles = padToLength(toBullets(parsed.outreach_angles, 12), 5, [
    'Focus on one measurable workflow outcome and verify baseline.',
    'Show how execution quality improves with clearer prioritization.',
    'Propose a narrow pilot before broader rollout.',
    'Anchor messaging to role-level ownership and urgency.',
    'De-risk adoption with explicit success criteria.',
  ])
  const objectionHandling = padToLength(toBullets(parsed.objection_handling, 12), 5, [
    'Handle incumbency objections with a complementary positioning.',
    'Translate timing objections into measurable next-step checkpoints.',
    'Use concise information responses with one follow-up question.',
    'Clarify ownership when stakeholder mapping is unclear.',
    'Offer low-risk pilot path when commitment concerns appear.',
  ])
  const suggestedSequence = padToLength(toBullets(parsed.suggested_sequence, 20), 7, [
    'Email 1: hypothesis and one question.',
    'LinkedIn 1: short context and reply prompt.',
    'Call 1: permission-based opener.',
    'Email 2: practical workflow insight and CTA.',
    'LinkedIn 2: one tactical takeaway.',
    'Call 2: confirm priority and pilot scope.',
    'Email 3: close-the-loop follow-up.',
  ])

  const nextSteps = toBullets(parsed.next_steps, 12)
  const verificationChecklist = toBullets(parsed.verification_checklist, 12)

  const sections: CompetitiveReportSection[] = [
    {
      key: 'executive_summary',
      title: 'Executive summary',
      content:
        executiveSummary ||
        'Framework-based summary with explicit verification steps.',
    },
    {
      key: 'market_context',
      title: 'Market context & positioning',
      bullets: marketContext,
    },
    { key: 'competitor_map', title: 'Competitor map', bullets: competitorMap },
    {
      key: 'differentiators',
      title: 'Differentiators & vulnerabilities',
      bullets: differentiators,
    },
    {
      key: 'buying_triggers',
      title: 'Buying triggers & “why now” angles',
      bullets: buyingTriggers,
    },
    {
      key: 'outreach_angles',
      title: 'Recommended outreach angles (5)',
      bullets: outreachAngles,
    },
    {
      key: 'objection_handling',
      title: 'Objection handling (5)',
      bullets: objectionHandling,
    },
    {
      key: 'sequence',
      title: 'Suggested 7-touch sequence (email + linkedin + call openers)',
      bullets: suggestedSequence,
    },
    { key: 'next_steps', title: 'Next steps checklist', bullets: nextSteps },
    {
      key: 'verification_checklist',
      title: 'Verification checklist (to avoid guessing)',
      bullets: verificationChecklist,
    },
  ]

  return {
    reportMarkdown: renderReportMarkdown(input.companyName, sections),
    reportJson: { sections },
    model: aiResult.model,
  }
}

function renderReportMarkdown(companyName: string, sections: CompetitiveReportSection[]): string {
  const byKey = new Map(sections.map((section) => [section.key, section] as const))

  const executive = byKey.get('executive_summary')
  const market = byKey.get('market_context')
  const competitors = byKey.get('competitor_map')
  const differentiators = byKey.get('differentiators')
  const triggers = byKey.get('buying_triggers')
  const angles = byKey.get('outreach_angles')
  const objections = byKey.get('objection_handling')
  const sequence = byKey.get('sequence')
  const nextSteps = byKey.get('next_steps')
  const verification = byKey.get('verification_checklist')

  const executiveText =
    executive && 'content' in executive
      ? ensureNoBracketTokens(executive.content)
      : 'Framework-based summary with explicit verification steps.'

  const markdown = [
    `# Competitive Intelligence Report: ${ensureNoBracketTokens(companyName)}`,
    '',
    '## Executive summary',
    executiveText,
    '',
    '## Market context & positioning',
    formatBullets(market && 'bullets' in market ? market.bullets : []),
    '',
    '## Competitor map',
    formatBullets(competitors && 'bullets' in competitors ? competitors.bullets : []),
    '',
    '## Differentiators & vulnerabilities',
    formatBullets(differentiators && 'bullets' in differentiators ? differentiators.bullets : []),
    '',
    '## Buying triggers & “why now” angles',
    formatBullets(triggers && 'bullets' in triggers ? triggers.bullets : []),
    '',
    '## Recommended outreach angles (5)',
    formatBullets(angles && 'bullets' in angles ? angles.bullets : []),
    '',
    '## Objection handling (5)',
    formatBullets(objections && 'bullets' in objections ? objections.bullets : []),
    '',
    '## Suggested 7-touch sequence (email + linkedin + call openers)',
    formatBullets(sequence && 'bullets' in sequence ? sequence.bullets : []),
    '',
    '## Next steps checklist',
    formatBullets(nextSteps && 'bullets' in nextSteps ? nextSteps.bullets : []),
    '',
    '## Verification checklist (to avoid guessing)',
    formatBullets(verification && 'bullets' in verification ? verification.bullets : []),
    '',
  ]

  return markdown.join('\n').trim() + '\n'
}
