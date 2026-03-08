import OpenAI from 'openai'
import { serverEnv } from '@/lib/env'
import { isE2E, isTestEnv } from '@/lib/runtimeFlags'

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

function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: serverEnv.OPENAI_API_KEY })
}

function toBullets(lines: unknown, max: number): string[] {
  if (!Array.isArray(lines)) return []
  return lines
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0)
    .slice(0, max)
}

function ensureNoBracketTokens(text: string): string {
  // Bracket tokens are forbidden in content pack; also read as placeholders.
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

export async function generateCompetitiveIntelligenceReport(
  input: CompetitiveReportGenerateInput
): Promise<CompetitiveReportGenerateResult> {
  const model = 'gpt-4o'

  // Keep unit/E2E tests deterministic and fast (no external calls).
  if (isE2E() || isTestEnv()) {
    const sections: CompetitiveReportSection[] = [
      {
        key: 'executive_summary',
        title: 'Executive summary',
        content:
          'This is a framework-based competitive report generated in test mode. It avoids factual claims and focuses on a repeatable analysis and outreach plan.',
      },
      {
        key: 'market_context',
        title: 'Market context & positioning',
        bullets: [
          'Positioning hypothesis: map their product to a single core job-to-be-done and validate on the homepage + docs.',
          'Category pressure: assume buyers compare “suite vs best-of-breed vs internal build” unless proven otherwise.',
          'Procurement reality: enterprise deals often stall on security + implementation; gather proof points up front.',
        ],
      },
      {
        key: 'competitor_map',
        title: 'Competitor map',
        bullets: [
          'Direct alternatives (verify): list 3 vendors mentioned on their pricing / integrations pages.',
          'Adjacent tools: systems they integrate with or replace (CRM, data, workflow, analytics).',
          'Internal status quo: spreadsheets, manual research, existing dashboards, “do nothing”.',
        ],
      },
      {
        key: 'differentiators',
        title: 'Differentiators & vulnerabilities',
        bullets: [
          'Differentiator template: speed-to-value, time-to-implement, coverage, or accuracy — pick one and prove it.',
          'Vulnerability template: unclear ROI, unclear implementation path, or shallow data sources — validate and address.',
        ],
      },
      {
        key: 'buying_triggers',
        title: 'Buying triggers & “why now” angles',
        bullets: [
          'Trigger hypothesis: new initiative + new owner + new deadline is when buyers re-evaluate tools.',
          'Angle: reduce cycle time / manual work tied to a measurable workflow step.',
          'If you have verified signals, use them explicitly and avoid adding new claims.',
        ],
      },
      {
        key: 'outreach_angles',
        title: 'Recommended outreach angles (5)',
        bullets: [
          'Angle 1: “time saved per rep” with a concrete workflow slice to validate.',
          'Angle 2: “fewer false positives / better prioritization” with a verification step.',
          'Angle 3: “standardize across team” with a governance hook.',
          'Angle 4: “fast pilot” with a 7-day plan and clear success criteria.',
          'Angle 5: “risk reduction” (security, compliance, auditability) with proof points to gather.',
        ],
      },
      {
        key: 'objection_handling',
        title: 'Objection handling (5)',
        bullets: [
          '“Already have a tool.” → Position as complementary; ask what’s missing and offer a narrow pilot.',
          '“No priority.” → Tie to a downstream metric and ask for the current process baseline.',
          '“Send info.” → Send a 3-bullet brief + a single question to route ownership.',
          '“Not my area.” → Ask who owns the workflow and what “good” looks like for them.',
          '“Timing.” → Offer to set a re-check trigger and share a small insight that creates curiosity.',
        ],
      },
      {
        key: 'sequence',
        title: 'Suggested 7-touch sequence (email + linkedin + call openers)',
        bullets: [
          'Email 1: short hypothesis + question.',
          'LinkedIn DM 1: 1 sentence + ask.',
          'Call opener 1: permission-based + confirm pain.',
          'Email 2: 2 proof points you can verify + narrow CTA.',
          'LinkedIn DM 2: share a checklist + ask who owns it.',
          'Call opener 2: reference prior note + one concrete next step.',
          'Email 3: breakup + “should I close the loop?”',
        ],
      },
      {
        key: 'next_steps',
        title: 'Next steps checklist',
        bullets: [
          'Confirm the category + primary buyer on the website (homepage, pricing, docs).',
          'Collect 3 competitor names from their own site copy (avoid guessing).',
          'Pick 1 outreach angle and draft a 7-day pilot plan with success metrics.',
        ],
      },
      {
        key: 'verification_checklist',
        title: 'Verification checklist (to avoid guessing)',
        bullets: [
          'Homepage / product page: category, primary use case, ICP, proof points.',
          'Pricing page: packaging signals and who the buyer is.',
          'Careers page: hiring focus areas (team names, keywords).',
          'Press / blog: what they claim is new (validate dates and details).',
          'Review sites (G2/Capterra): recurring pros/cons and alternatives listed.',
          'LinkedIn posts: current initiatives and messaging themes.',
        ],
      },
    ]

    const reportMarkdown = renderReportMarkdown(input.companyName, sections)
    return { reportMarkdown, reportJson: { sections }, model }
  }

  const openai = getOpenAIClient()

  const verifiedSignalsText =
    input.verifiedSignals.length > 0
      ? input.verifiedSignals
          .slice(0, 8)
          .map((s) => {
            const when = s.detectedAt ? ` (${s.detectedAt})` : ''
            const src = s.sourceUrl ? ` — ${s.sourceUrl}` : ''
            const type = s.eventType ? ` [${s.eventType}]` : ''
            const desc = s.description ? ` — ${s.description}` : ''
            return `- ${s.headline}${type}${when}${src}${desc}`
          })
          .join('\n')
      : '- (none)'

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 1600,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You generate competitive intelligence reports for B2B sellers.',
          'Hard rules (must follow):',
          '- Do NOT invent factual claims about the company (no funding, layoffs, partnerships, product launches, numbers, customers, pricing, market share, tech stack) unless it is explicitly provided under "Verified signals".',
          '- If you do not have verified sources, write in hypotheses and explicitly label them as hypotheses or "needs verification".',
          '- Do NOT include any calls-to-action to view a report on a website. Do NOT include the URL https://dazrael.com/competitive-report.',
          '- No placeholder tokens like [COMPANY] or [NAME].',
          '- The output must be useful without external data: provide analysis frameworks, outreach angles, objection handling, and a sequence that uses questions/assumptions rather than claims.',
          '',
          'Output format:',
          'Return a JSON object with keys:',
          '- executive_summary: string',
          '- market_context: string[]',
          '- competitor_map: string[]',
          '- differentiators_vulnerabilities: string[]',
          '- buying_triggers: string[]',
          '- outreach_angles: string[]  (exactly 5 items)',
          '- objection_handling: string[] (exactly 5 items)',
          '- suggested_sequence: string[] (exactly 7 items; include channel per item)',
          '- next_steps: string[]',
          '- verification_checklist: string[]',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Company name: ${input.companyName}`,
          input.companyDomain ? `Company domain: ${input.companyDomain}` : 'Company domain: (not provided)',
          input.inputUrl ? `Input URL: ${input.inputUrl}` : 'Input URL: (not provided)',
          '',
          'User context (about the seller; optional):',
          input.userContext.whatYouSell ? `- What we sell: ${input.userContext.whatYouSell}` : '- What we sell: (not provided)',
          input.userContext.idealCustomer ? `- Ideal customer: ${input.userContext.idealCustomer}` : '- Ideal customer: (not provided)',
          '',
          'Verified signals (only allowed factual claims):',
          verifiedSignalsText,
          '',
          'Generate the report content now.',
        ].join('\n'),
      },
    ],
  })

  const content = response.choices?.[0]?.message?.content?.trim() || ''
  if (!content) {
    throw new Error('competitive_report_empty_response')
  }

  const parsed = JSON.parse(content) as Record<string, unknown>

  const executiveSummaryRaw = typeof parsed.executive_summary === 'string' ? parsed.executive_summary.trim() : ''
  const executiveSummary = ensureNoBracketTokens(executiveSummaryRaw)

  const marketContext = toBullets(parsed.market_context, 12)
  const competitorMap = toBullets(parsed.competitor_map, 12)
  const differentiators = toBullets(parsed.differentiators_vulnerabilities, 14)
  const buyingTriggers = toBullets(parsed.buying_triggers, 12)

  const outreachAngles = padToLength(toBullets(parsed.outreach_angles, 12), 5, [
    'Angle: confirm the core workflow they want faster, then attach one measurable “before → after” outcome (hypothesis; verify).',
    'Angle: reduce manual research time by standardizing what gets checked and when (hypothesis; verify).',
    'Angle: eliminate “who should we prioritize?” debates with a consistent scoring rubric (hypothesis; verify).',
    'Angle: de-risk rollout with a narrow pilot and clear success criteria (hypothesis; verify).',
    'Angle: improve handoffs by making signals + context shareable and auditable (hypothesis; verify).',
  ])
  const objectionHandling = padToLength(toBullets(parsed.objection_handling, 12), 5, [
    'Objection: “We already have something.” Response: position as complementary; ask what’s missing; propose a narrow pilot with success criteria.',
    'Objection: “Not a priority.” Response: tie to one metric; ask for baseline; offer a small, low-lift step to validate.',
    'Objection: “Send info.” Response: send a 3-bullet summary plus one question to route ownership.',
    'Objection: “Not my area.” Response: ask who owns the workflow and what “good” looks like; offer to tailor to that owner.',
    'Objection: “Timing.” Response: set a re-check trigger and share a verification checklist to create urgency without claims.',
  ])
  const suggestedSequence = padToLength(toBullets(parsed.suggested_sequence, 20), 7, [
    'Email 1: short hypothesis + one question (no claims).',
    'LinkedIn DM 1: one line + “worth comparing notes?” question.',
    'Call opener 1: permission-based + confirm the workflow owner.',
    'Email 2: share verification checklist + ask which competitor(s) matter most.',
    'LinkedIn DM 2: share one “why now” hypothesis + ask for current process baseline.',
    'Call opener 2: reference the checklist + propose a narrow pilot scope.',
    'Email 3: breakup + “should I close the loop?”',
  ])

  const nextSteps = toBullets(parsed.next_steps, 12)
  const verificationChecklist = toBullets(parsed.verification_checklist, 12)

  const sections: CompetitiveReportSection[] = [
    {
      key: 'executive_summary',
      title: 'Executive summary',
      content:
        (executiveSummary || 'Framework-based summary with explicit verification steps.') +
        (input.verifiedSignals.length === 0
          ? '\n\nNote: No verified signals were available in your LeadIntel account for this company. This report is framework-based and includes a verification checklist.'
          : ''),
    },
    { key: 'market_context', title: 'Market context & positioning', bullets: marketContext },
    { key: 'competitor_map', title: 'Competitor map', bullets: competitorMap },
    { key: 'differentiators', title: 'Differentiators & vulnerabilities', bullets: differentiators },
    {
      key: 'buying_triggers',
      title: 'Buying triggers & “why now” angles',
      bullets:
        input.verifiedSignals.length > 0
          ? [
              ...input.verifiedSignals.slice(0, 5).map((s) => {
                const when = s.detectedAt ? ` (${s.detectedAt.slice(0, 10)})` : ''
                const src = s.sourceUrl ? ` — ${s.sourceUrl}` : ''
                const type = s.eventType ? ` [${s.eventType}]` : ''
                return `Verified signal${type}${when}: ${s.headline}${src}`
              }),
              ...buyingTriggers,
            ]
          : buyingTriggers,
    },
    { key: 'outreach_angles', title: 'Recommended outreach angles (5)', bullets: outreachAngles },
    { key: 'objection_handling', title: 'Objection handling (5)', bullets: objectionHandling },
    { key: 'sequence', title: 'Suggested 7-touch sequence (email + linkedin + call openers)', bullets: suggestedSequence },
    { key: 'next_steps', title: 'Next steps checklist', bullets: nextSteps },
    { key: 'verification_checklist', title: 'Verification checklist (to avoid guessing)', bullets: verificationChecklist },
  ]

  const reportMarkdown = renderReportMarkdown(input.companyName, sections)
  return { reportMarkdown, reportJson: { sections }, model }
}

function renderReportMarkdown(companyName: string, sections: CompetitiveReportSection[]): string {
  const byKey = new Map(sections.map((s) => [s.key, s] as const))

  const exec = byKey.get('executive_summary')
  const market = byKey.get('market_context')
  const competitors = byKey.get('competitor_map')
  const diff = byKey.get('differentiators')
  const triggers = byKey.get('buying_triggers')
  const angles = byKey.get('outreach_angles')
  const objections = byKey.get('objection_handling')
  const sequence = byKey.get('sequence')
  const nextSteps = byKey.get('next_steps')
  const verify = byKey.get('verification_checklist')

  const execText = exec && 'content' in exec ? ensureNoBracketTokens(exec.content) : ''

  const fallback = {
    market_context: [
      'Positioning hypothesis: map the company to one primary job-to-be-done and verify on the homepage + docs.',
      'Buying dynamics: expect “suite vs best-of-breed vs internal build” comparisons unless proven otherwise.',
      'Procurement: security and implementation risk often drive stalls; gather proof points early.',
    ],
    competitor_map: [
      'Direct alternatives (verify): list competitors mentioned on their own site (integrations, migrations, comparisons).',
      'Adjacent tools: systems they integrate with or replace (CRM, data, workflow, analytics).',
      'Internal status quo: spreadsheets, manual research, homegrown dashboards, “do nothing”.',
    ],
    differentiators: [
      'Differentiator framework: speed-to-value, time-to-implement, coverage, or accuracy — pick one and prove it.',
      'Vulnerability framework: unclear ROI, unclear implementation path, or shallow data sources — validate and address.',
    ],
    buying_triggers: [
      'Trigger hypothesis: new initiative + new owner + new deadline is when buyers re-evaluate tools (verify).',
      'Angle: reduce cycle time / manual work tied to one measurable workflow step (verify).',
      'If verified signals exist, use them as the only factual “why now” inputs.',
    ],
    next_steps: [
      'Confirm category + primary buyer on the website (homepage, pricing, docs).',
      'Collect 3 competitor names from their own materials (avoid guessing).',
      'Pick 1 outreach angle and draft a 7-day pilot with clear success metrics.',
    ],
    verification_checklist: [
      'Pricing page: packaging signals and who the buyer is.',
      'Careers page: hiring focus areas (team names, keywords).',
      'Press/blog: what they claim is new (validate dates and details).',
      'Review sites (G2/Capterra): recurring pros/cons and alternatives listed.',
      'LinkedIn posts: current initiatives and messaging themes.',
    ],
  } as const

  const md = [
    `# Competitive Intelligence Report: ${ensureNoBracketTokens(companyName)}`,
    '',
    '## Executive summary',
    execText || 'Framework-based summary with explicit verification steps.',
    '',
    '## Market context & positioning',
    formatBullets(market && 'bullets' in market && market.bullets.length > 0 ? market.bullets : [...fallback.market_context]),
    '',
    '## Competitor map',
    formatBullets(competitors && 'bullets' in competitors && competitors.bullets.length > 0 ? competitors.bullets : [...fallback.competitor_map]),
    '',
    '## Differentiators & vulnerabilities',
    formatBullets(diff && 'bullets' in diff && diff.bullets.length > 0 ? diff.bullets : [...fallback.differentiators]),
    '',
    '## Buying triggers & “why now” angles',
    formatBullets(triggers && 'bullets' in triggers && triggers.bullets.length > 0 ? triggers.bullets : [...fallback.buying_triggers]),
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
    formatBullets(nextSteps && 'bullets' in nextSteps && nextSteps.bullets.length > 0 ? nextSteps.bullets : [...fallback.next_steps]),
    '',
    '## Verification checklist (to avoid guessing)',
    formatBullets(verify && 'bullets' in verify && verify.bullets.length > 0 ? verify.bullets : [...fallback.verification_checklist]),
    '',
  ]

  // Final safety: remove the self-link if the model tried to sneak it in.
  return md.join('\n').replace(/https?:\/\/dazrael\.com\/competitive-report\S*/gi, '').trim() + '\n'
}

