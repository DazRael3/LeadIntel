export type CompareTableRow = {
  dimension: string
  leadintel: string
  competitor: string
}

export type CompareFaq = { q: string; a: string }

export type CompetitorMatrixEntry = {
  key: 'usergems' | 'common_room' | 'zoominfo_copilot' | 'apollo' | 'leadintel'
  name: string
  threatScore: number
  threatSummary: string
  leadIntelWins: string
  theyDoBetter: string
  compareSlug?: string
}

export type ComparePage = {
  slug: string
  competitorName: string
  competitorType: string
  bestFor: string
  bestForSections?: { leadintel: string[]; competitor: string[] }
  title: string
  description: string
  quickVerdict?: string
  hero: {
    summary: string
    atAGlance: { leadintelFocus: string; competitorFocus: string }
  }
  useTogether: string[]
  whoWins: { leadintel: string[]; competitor: string[] }
  whereLeadIntelBetter?: string[]
  whereCompetitorStronger?: string[]
  finalRecommendation?: string
  whenLeadIntel: string[]
  whenCompetitor: string[]
  checklist: string[]
  migrationSteps: string[]
  table: CompareTableRow[]
  faqs: CompareFaq[]
  ctas: {
    primaryHref: string
    primaryLabel: string
    secondaryHref: string
    secondaryLabel: string
    bottomTitle: string
    bottomBody: string
    bottomPrimaryHref: string
    bottomPrimaryLabel: string
    bottomSecondaryHref: string
    bottomSecondaryLabel: string
  }
}

function varies(): string {
  return 'Varies by plan / configuration'
}

export const COMPETITOR_MATRIX: CompetitorMatrixEntry[] = [
  {
    key: 'usergems',
    name: 'UserGems',
    threatScore: 9.3,
    threatSummary: 'Strongest direct signal-to-action rival with deeper scoring, buying-group context, workflows, and proof.',
    leadIntelWins: 'Cleaner message, easier first trial, lower-friction understanding.',
    theyDoBetter: 'Signal breadth, account + contact depth, workflow automation, visible proof, trust maturity.',
    compareSlug: 'leadintel-vs-usergems',
  },
  {
    key: 'common_room',
    name: 'Common Room',
    threatScore: 9.1,
    threatSummary: 'Broader and more mature signal/integration platform with strong identity and workflow depth.',
    leadIntelWins: 'Sharper story for pure outbound teams and simpler value communication.',
    theyDoBetter: 'Integration breadth, identity resolution, enterprise trust, signal capture depth, workflow sophistication.',
    compareSlug: 'leadintel-vs-common-room',
  },
  {
    key: 'zoominfo_copilot',
    name: 'ZoomInfo Copilot',
    threatScore: 8.8,
    threatSummary: 'Enterprise-grade GTM intelligence with data scale, buyer intent, and procurement confidence.',
    leadIntelWins: 'Lighter, clearer, easier to grasp, less bloated public story.',
    theyDoBetter: 'Contact depth, buying groups, CRM depth, intent breadth, trust maturity.',
    compareSlug: 'leadintel-vs-zoominfo-copilot',
  },
  {
    key: 'apollo',
    name: 'Apollo',
    threatScore: 8.2,
    threatSummary: 'Bundled prospecting and engagement platform with strong breadth and adoption.',
    leadIntelWins: 'Better why-now focus and clearer public explainability.',
    theyDoBetter: 'Bundled prospecting, contacts, engagement tooling, integration breadth, broad workflow coverage.',
    compareSlug: 'leadintel-vs-apollo',
  },
  {
    key: 'leadintel',
    name: 'LeadIntel',
    threatScore: 7.3,
    threatSummary: 'Best on clarity, explainability, and speed-to-value, but not yet deepest in the category.',
    leadIntelWins: 'Message clarity, no-signup evaluation, transparent pricing, explainable scoring.',
    theyDoBetter: 'Signal breadth, buyer/contact depth, proof, workflow depth, trust maturity.',
  },
] as const

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: 'leadintel-vs-usergems',
    competitorName: 'UserGems',
    competitorType: 'Signal-to-action outbound platform',
    bestFor: 'Best for: teams who want deeper signal coverage and strong signal-to-action workflows.',
    bestForSections: {
      leadintel: [
        'Outbound teams who want a daily shortlist and explainable scoring.',
        'Reps who need send-ready outreach without a heavy platform rollout.',
        'Buyers who value low-friction evaluation and clear positioning.',
      ],
      competitor: [
        'Teams prioritizing deeper signal breadth and automation.',
        'Motions needing account + contact/buying-group context in the same system.',
        'Organizations that prefer mature proof and enterprise trust signals.',
      ],
    },
    title: 'LeadIntel vs UserGems — why-now signals and send-ready outreach',
    description:
      'LeadIntel is easier to understand and faster to evaluate. UserGems is stronger today on signal depth, account + contact workflows, and workflow automation.',
    quickVerdict:
      'LeadIntel is easier to understand and faster to evaluate. UserGems is stronger today on signal depth, account + contact workflows, and workflow automation.',
    hero: {
      summary:
        'LeadIntel is easier to understand and faster to evaluate. UserGems is stronger today on signal depth, account + contact workflows, and workflow automation.',
      atAGlance: {
        leadintelFocus: 'Why-now signals → daily shortlist → explainable score → send-ready outreach.',
        competitorFocus: 'Deeper signal coverage and mature signal-to-action workflows.',
      },
    },
    useTogether: [
      'Use UserGems when you need deeper signal breadth and workflow automation.',
      'Use LeadIntel when you want a clean daily shortlist and explainable reasons that reps can act on fast.',
      'If you run both, standardize messaging in one place (templates) and measure execution discipline.',
    ],
    whoWins: {
      leadintel: [
        'You need a workflow that reps understand on day one.',
        'You want explainable 0–100 scoring with visible reasons.',
        'You want a no-signup sample path to validate the loop.',
      ],
      competitor: [
        'You want deeper signal coverage and automation.',
        'You need richer account + contact/buying-group context.',
        'You want mature proof and enterprise trust signals.',
      ],
    },
    whereLeadIntelBetter: [
      'Cleaner message and easier first trial.',
      'Lower-friction understanding of the workflow and value.',
      'Explainable prioritization surfaced as a daily shortlist.',
    ],
    whereCompetitorStronger: [
      'Signal breadth and depth.',
      'Account + contact/buying-group workflows.',
      'Workflow automation and proof/trust maturity.',
    ],
    finalRecommendation:
      'Choose LeadIntel when you want fast time-to-value, explainability, and a rep-friendly daily loop. Choose UserGems when you need deeper signal coverage and mature signal-to-action automation.',
    whenLeadIntel: [
      'You want a daily shortlist that is easy to run operationally.',
      'You prefer explainability over black-box prioritization.',
      'You want to validate quickly without a long sales cycle.',
    ],
    whenCompetitor: [
      'You need deeper signal coverage and automation.',
      'You need buying-group context and richer workflow depth.',
      'You want a platform with mature proof and enterprise readiness.',
    ],
    checklist: [
      'Is time-to-value more important than maximum coverage?',
      'Do reps need explainability to trust prioritization?',
      'Do you need buying-group depth today?',
      'Do you want a no-signup evaluation path?',
      'Do you need automation beyond push/export?',
      'Are you optimizing for rep execution or platform breadth?',
      'Do you want a daily shortlist as the primary surface?',
      'Is enterprise trust maturity a procurement requirement right now?',
      'Do you already have strong templates/playbooks, or do you need the system to provide them?',
      'What does success in week 1 look like for your team?',
    ],
    migrationSteps: [
      'Define your ICP (who you want, who you don’t).',
      'Add a watchlist of 10–25 target accounts.',
      'Run the daily loop: shortlist → explain → draft → action.',
      'Standardize messaging using templates; refine based on outcomes.',
      'Expand signal coverage and automation depth as your workflow matures.',
    ],
    table: [
      { dimension: 'Why-now prioritization', leadintel: 'Yes (shortlist + reasons)', competitor: varies() },
      { dimension: 'Explainable scoring', leadintel: 'Yes (deterministic reasons)', competitor: varies() },
      { dimension: 'Daily shortlist workflow', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Send-ready outreach', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Account watchlists', leadintel: 'Yes', competitor: varies() },
      {
        dimension: 'Contact/buying-group depth',
        leadintel: 'Persona-level recommendations (heuristic), not a contact database',
        competitor: varies(),
      },
      {
        dimension: 'Workflow/action depth',
        leadintel: 'Action center + saved briefs + webhooks/exports for handoff',
        competitor: varies(),
      },
      { dimension: 'Public pricing clarity', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Trust-center maturity', leadintel: 'Public trust pages', competitor: varies() },
      { dimension: 'Best-fit motion', leadintel: 'Account-based outbound timing + messaging', competitor: varies() },
    ],
    faqs: [
      { q: 'Is this an apples-to-apples replacement?', a: 'Not always. If you need maximum signal breadth and automation depth, UserGems may be a stronger fit. If you want a clean daily loop that reps can run, LeadIntel is designed for that.' },
      { q: 'Can I validate LeadIntel without a sales cycle?', a: 'Yes. You can generate a sample digest without signup and see the workflow before you buy.' },
      { q: 'How does LeadIntel avoid black-box scoring?', a: 'LeadIntel uses deterministic scoring with visible reasons so reps can understand and trust prioritization.' },
      { q: 'Does LeadIntel do contact enrichment?', a: 'Not as a core product surface. LeadIntel is designed for timing, prioritization, and message execution on your targets.' },
      { q: 'What’s the fastest path to value?', a: 'Set ICP, add a watchlist, then run the daily shortlist + send-ready outreach loop.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'Evaluate the workflow quickly',
      bottomBody: 'Try the no-signup sample digest, then decide if the daily shortlist + explainability loop fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/how-scoring-works',
      bottomSecondaryLabel: 'Review scoring methodology',
    },
  },
  {
    slug: 'leadintel-vs-apollo',
    competitorName: 'Apollo',
    competitorType: 'Prospecting + outbound tooling',
    bestFor: 'Best for: bundled prospecting + engagement workflows.',
    bestForSections: {
      leadintel: [
        'Account-based outbound teams who already have targets and care about timing.',
        'Reps who want a daily shortlist with explainable scoring.',
        'Teams that want send-ready outreach drafts tied to why-now signals.',
      ],
      competitor: [
        'Teams prioritizing contact discovery and list building.',
        'Workflows where outbound tooling is the primary decision criterion.',
        'Motions optimizing for coverage and volume. ' + varies() + '.',
      ],
    },
    title: 'LeadIntel vs Apollo — why-now prioritization vs database breadth',
    description:
      'LeadIntel is better when timing and prioritization matter more than raw database breadth. Apollo is stronger when buyers want bundled prospecting and engagement in one system.',
    quickVerdict:
      'LeadIntel is better when timing and prioritization matter more than raw database breadth. Apollo is stronger when buyers want bundled prospecting and engagement in one system.',
    hero: {
      summary:
        'LeadIntel is better when timing and prioritization matter more than raw database breadth. Apollo is stronger when buyers want bundled prospecting and engagement in one system.',
      atAGlance: {
        leadintelFocus: 'Daily “why now” shortlist for your watchlist + send-ready drafts.',
        competitorFocus: 'Prospecting workflow (contacts/accounts) and outbound tooling. ' + varies() + '.',
      },
    },
    useTogether: [
      'Use Apollo for contact discovery and list building.',
      'Use LeadIntel to monitor your chosen accounts for timing signals and produce a daily shortlist.',
      'Paste LeadIntel drafts into your existing sequencing/outbound workflow.',
    ],
    whoWins: {
      leadintel: [
        'You already know your target accounts and care about timing.',
        'You want a daily shortlist, not another backlog.',
        'You want “why now” context you can paste into outreach.',
        'You want pitch drafts (email/DM/call openers) fast.',
        'You want a tight loop: signals → prioritize → draft → send.',
      ],
      competitor: [
        'You need a large contact discovery workflow.',
        'Your main problem is building lists from scratch.',
        'You want outbound tooling bundled with prospecting.',
        'You’re optimizing for contact volume and coverage.',
        'You have a process for timing and messaging already.',
      ],
    },
    whereLeadIntelBetter: [
      'Better why-now focus and clearer public explainability.',
      'Daily shortlist loop for account-based motions.',
      'Send-ready drafts tied to timing.',
    ],
    whereCompetitorStronger: [
      'Bundled prospecting and engagement tooling.',
      'Contact discovery and list building.',
      'Broad workflow coverage and adoption.',
    ],
    finalRecommendation:
      'Choose LeadIntel when you care about timing, prioritization, and explainable reasons. Choose Apollo when you want a bundled prospecting + engagement system as the backbone.',
    whenLeadIntel: [
      'You run account-based outbound and need daily prioritization.',
      'Timing and recency of signals matter for your replies.',
      'You want send-ready drafts based on your ICP.',
    ],
    whenCompetitor: [
      'You need contact discovery first and foremost.',
      'Your team is selecting a broad prospecting tool as a baseline.',
      'You prefer one platform that bundles multiple outbound functions.',
    ],
    checklist: [
      'Do you need daily prioritization or just data access?',
      'Do you already have a target account list (watchlist) you trust?',
      'Is “why now” context critical for your replies?',
      'Do you want send-ready drafts or just raw data?',
      'Do you need contact discovery at scale?',
      'Do you already have sequencing elsewhere?',
      'Is your motion account-based (fewer accounts, deeper relevance) or volume-based?',
      'Do you want a simple daily loop or a multi-module platform?',
      'Do you need reasons behind a score (transparent prioritization)?',
      'What does “value in week 1” look like for your team?',
      'Do you need a team-wide messaging standard that stays consistent?',
      'Do you want triggers tied to a fixed watchlist (vs broad browsing)?',
    ],
    migrationSteps: [
      'Define your ICP (who you want, who you don’t).',
      'Build a watchlist of 10–25 target accounts (use your existing lists as inputs).',
      'Set a cadence: review the daily shortlist and run one outreach block per day.',
      'Use templates and pitch drafts for first-touch and follow-ups; paste into your sequencer if you use one.',
      'Review outcomes weekly and refine the angles/tokens for your ICP.',
    ],
    table: [
      { dimension: 'Why-now prioritization', leadintel: 'Yes (shortlist + reasons)', competitor: varies() },
      { dimension: 'Explainable scoring', leadintel: 'Yes (deterministic reasons)', competitor: varies() },
      { dimension: 'Daily shortlist workflow', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Send-ready outreach', leadintel: 'Yes (drafts)', competitor: varies() },
      { dimension: 'Account watchlists', leadintel: 'Yes', competitor: varies() },
      {
        dimension: 'Contact/buying-group depth',
        leadintel: 'Persona-level recommendations (heuristic), not a contact database',
        competitor: varies(),
      },
      {
        dimension: 'Workflow/action depth',
        leadintel: 'Action center + saved briefs + webhooks/exports for handoff',
        competitor: varies(),
      },
      { dimension: 'Public pricing clarity', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Trust-center maturity', leadintel: 'Public trust pages', competitor: varies() },
      { dimension: 'Best-fit motion', leadintel: 'Account-based outbound timing + messaging', competitor: 'Bundled prospecting + engagement (' + varies() + ')' },
    ],
    faqs: [
      { q: 'Can I use both together?', a: 'Yes. Many teams split responsibilities: one tool for prospecting, another for daily timing and “why now” outreach. LeadIntel can sit downstream of your list-building workflow.' },
      { q: 'Will LeadIntel replace Apollo?', a: 'Not always. If your main need is contact discovery or a bundled outbound platform, you may keep Apollo. LeadIntel is best when you want a daily shortlist and drafts tied to triggers.' },
      { q: 'What if I already have sequencing?', a: 'That’s fine. LeadIntel focuses on prioritization and drafts. You can paste outputs into your existing sequencing tool or workflow.' },
      { q: 'How does scoring work?', a: 'LeadIntel uses a deterministic 0–100 score with visible reasons, so you can sanity-check and adjust your focus quickly.' },
      { q: 'What’s required to get value in week 1?', a: 'Define your ICP, add 10–25 target accounts, and review the daily shortlist. You should see clearer “who to touch today” decisions and draft-ready outreach.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
  {
    slug: 'leadintel-vs-common-room',
    competitorName: 'Common Room',
    competitorType: 'Signal + integration platform',
    bestFor: 'Best for: broader community/GTMs signals and integration-heavy orchestration.',
    bestForSections: {
      leadintel: [
        'Rep-level outbound timing with a simple daily loop.',
        'Teams who want a daily shortlist and explainable reasons.',
        'Buyers who prefer a focused workflow over broad orchestration.',
      ],
      competitor: [
        'Teams with deep integration requirements and identity resolution needs.',
        'Organizations building signal pipelines across many sources.',
        'Broader GTM orchestration across teams. ' + varies() + '.',
      ],
    },
    title: 'LeadIntel vs Common Room — why-now outbound vs broad signal orchestration',
    description:
      'LeadIntel is more focused for rep-level outbound timing. Common Room is broader and stronger on integration depth, identity resolution, and enterprise GTM orchestration.',
    quickVerdict:
      'LeadIntel is more focused for rep-level outbound timing. Common Room is broader and stronger on integration depth, identity resolution, and enterprise GTM orchestration.',
    hero: {
      summary:
        'LeadIntel is more focused for rep-level outbound timing. Common Room is broader and stronger on integration depth, identity resolution, and enterprise GTM orchestration.',
      atAGlance: {
        leadintelFocus: 'Daily shortlist + explainable scoring + send-ready outreach.',
        competitorFocus: 'Broader signal capture + integration depth + identity resolution.',
      },
    },
    useTogether: [
      'Use Common Room when you need a broad signal pipeline and deep integrations.',
      'Use LeadIntel when you want a rep-friendly daily shortlist and send-ready outreach loop.',
      'If you run both, route signals into a shortlist and standardize first touches via templates.',
    ],
    whoWins: {
      leadintel: [
        'Your motion is outbound and you want a daily shortlist surface.',
        'You want explainable scoring and reasons reps can act on.',
        'You want a clear product story and transparent evaluation.',
      ],
      competitor: [
        'You need integration breadth and identity resolution.',
        'You’re orchestrating signals across multiple teams and systems.',
        'You want deeper workflow sophistication and enterprise trust signals.',
      ],
    },
    whereLeadIntelBetter: [
      'Sharper story for pure outbound teams and simpler value communication.',
      'Lower-friction evaluation and faster time-to-value.',
      'Explainable prioritization built into the daily loop.',
    ],
    whereCompetitorStronger: [
      'Integration breadth and identity resolution.',
      'Signal capture depth across sources.',
      'Enterprise trust maturity and workflow sophistication.',
    ],
    finalRecommendation:
      'Choose LeadIntel when you want a focused why-now outbound workflow reps can run daily. Choose Common Room when you need broad signal orchestration, deep integrations, and identity resolution.',
    whenLeadIntel: [
      'You want rep-level daily prioritization from why-now signals.',
      'You prefer a focused workflow over broad platform scope.',
      'You want send-ready outreach tied to prioritization.',
    ],
    whenCompetitor: [
      'You need integration breadth and identity resolution.',
      'You want broader signal capture and orchestration.',
      'You’re prioritizing enterprise GTM platform requirements.',
    ],
    checklist: [
      'Do you need identity resolution across many sources?',
      'Is your core workflow rep-level outbound timing?',
      'Do you want a daily shortlist as the primary interface?',
      'How many integrations do you need on day one?',
      'Do you need orchestration across teams beyond outbound?',
      'Is explainable scoring required for rep trust?',
      'Is enterprise procurement a hard constraint right now?',
      'Do you want to start focused and expand, or start broad?',
      'Do you need workflow automation beyond push/export?',
      'What is the simplest path to measurable execution?',
    ],
    migrationSteps: [
      'Define ICP and your target account list.',
      'Choose signal sources that actually drive replies for your motion.',
      'Run a daily loop: shortlist → explain → draft → action.',
      'Add integration/workflow depth as needed (webhooks/exports first).',
      'Standardize messaging via templates and iterate.',
    ],
    table: [
      { dimension: 'Why-now prioritization', leadintel: 'Yes (shortlist + reasons)', competitor: varies() },
      { dimension: 'Explainable scoring', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Daily shortlist workflow', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Send-ready outreach', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Account watchlists', leadintel: 'Yes', competitor: varies() },
      {
        dimension: 'Contact/buying-group depth',
        leadintel: 'Persona-level recommendations (heuristic), not a contact database',
        competitor: varies(),
      },
      {
        dimension: 'Workflow/action depth',
        leadintel: 'Action center + saved briefs + webhooks/exports for handoff',
        competitor: varies(),
      },
      { dimension: 'Public pricing clarity', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Trust-center maturity', leadintel: 'Public trust pages', competitor: varies() },
      { dimension: 'Best-fit motion', leadintel: 'Outbound timing and execution', competitor: varies() },
    ],
    faqs: [
      { q: 'Is Common Room “better” than LeadIntel?', a: 'They optimize for different scopes. Common Room is broader and more integration-heavy. LeadIntel is built for a focused why-now outbound loop with a daily shortlist and send-ready outreach.' },
      { q: 'Can I start with LeadIntel and add integrations later?', a: 'Yes. Many teams start with ICP + watchlist + daily shortlist, then add webhooks/exports as they operationalize.' },
      { q: 'Does LeadIntel do identity resolution?', a: 'Not as a core product surface today. LeadIntel focuses on account timing, prioritization, and rep execution.' },
      { q: 'Where do signals come from?', a: 'LeadIntel is explicit about sources and freshness when available and avoids making claims without sources.' },
      { q: 'What should I evaluate first?', a: 'Whether a daily shortlist + explainable scoring improves rep execution speed and consistency.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See the daily loop',
      bottomBody: 'Try the sample digest, then decide whether focused rep execution is the outcome you want.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/tour',
      bottomSecondaryLabel: 'Product tour',
    },
  },
  {
    slug: 'leadintel-vs-zoominfo-copilot',
    competitorName: 'ZoomInfo Copilot',
    competitorType: 'Enterprise GTM intelligence',
    bestFor: 'Best for: enterprise data breadth and procurement-ready GTM intelligence.',
    bestForSections: {
      leadintel: [
        'Teams who want why-now prioritization and send-ready outreach.',
        'Buyers who prefer clarity and low-friction evaluation.',
        'Outbound motions where timing matters more than database breadth.',
      ],
      competitor: [
        'Enterprises prioritizing data breadth and buying-group depth.',
        'Teams with deep CRM/process requirements.',
        'Procurement-heavy deployments. ' + varies() + '.',
      ],
    },
    title: 'LeadIntel vs ZoomInfo Copilot — focused why-now outbound vs enterprise depth',
    description:
      'LeadIntel is clearer and lighter for focused why-now outbound workflows. ZoomInfo Copilot is stronger on data breadth, contact depth, and enterprise readiness.',
    quickVerdict:
      'LeadIntel is clearer and lighter for focused why-now outbound workflows. ZoomInfo Copilot is stronger on data breadth, contact depth, and enterprise readiness.',
    hero: {
      summary:
        'LeadIntel is clearer and lighter for focused why-now outbound workflows. ZoomInfo Copilot is stronger on data breadth, contact depth, and enterprise readiness.',
      atAGlance: {
        leadintelFocus: 'Daily shortlist + explainable scoring + send-ready outreach.',
        competitorFocus: 'Enterprise-grade data breadth, contacts, intent, and depth.',
      },
    },
    useTogether: [
      'Use ZoomInfo for contact depth and enterprise-grade data needs.',
      'Use LeadIntel for daily prioritization and send-ready messaging tied to timing.',
      'If you run both, keep LeadIntel as the execution loop and standardize outreach outputs.',
    ],
    whoWins: {
      leadintel: [
        'You want a clear why-now workflow for reps.',
        'You want explainable scoring and a daily shortlist.',
        'You want a product that is easy to evaluate publicly.',
      ],
      competitor: [
        'You need contact depth and buying-group views.',
        'You want broad intent and enterprise GTM intelligence depth.',
        'You need enterprise trust maturity as a procurement requirement.',
      ],
    },
    whereLeadIntelBetter: [
      'Lighter, clearer, easier to grasp, less bloated public story.',
      'Fast time-to-value via watchlist + shortlist loop.',
      'Explainability and send-ready execution surfaces.',
    ],
    whereCompetitorStronger: [
      'Contact depth and buying groups.',
      'Intent breadth and data scale.',
      'Enterprise trust maturity and procurement confidence.',
    ],
    finalRecommendation:
      'Choose LeadIntel when you want a focused why-now outbound workflow that drives daily execution. Choose ZoomInfo Copilot when enterprise data breadth and buying-group depth are the primary requirement.',
    whenLeadIntel: [
      'You want a daily shortlist and send-ready outreach loop.',
      'You want explainability and a rep-friendly workflow.',
      'You want a clear public evaluation path.',
    ],
    whenCompetitor: [
      'You need large-scale contact and intent depth.',
      'You need buying-group and CRM depth.',
      'You have enterprise procurement requirements.',
    ],
    checklist: [
      'Do you need buying-group depth today?',
      'Is your bottleneck timing/prioritization or data access?',
      'Do reps need explainability to execute daily?',
      'Do you need enterprise trust maturity as a hard requirement?',
      'Do you already have a target account list?',
      'Do you want a daily shortlist as the primary surface?',
      'Do you need workflow depth beyond push/export?',
      'Do you want to evaluate without a long sales cycle?',
      'Is database breadth a core buying criterion?',
      'What does week-1 success look like?',
    ],
    migrationSteps: [
      'Start with ICP and a target account list.',
      'Run daily loop: shortlist → explain → draft → action.',
      'Add deeper data sources and buying-group context as needed.',
      'Standardize messaging via templates and keep outputs consistent.',
      'Review outcomes and adjust signal weighting over time.',
    ],
    table: [
      { dimension: 'Why-now prioritization', leadintel: 'Yes (shortlist + reasons)', competitor: varies() },
      { dimension: 'Explainable scoring', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Daily shortlist workflow', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Send-ready outreach', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Account watchlists', leadintel: 'Yes', competitor: varies() },
      {
        dimension: 'Contact/buying-group depth',
        leadintel: 'Persona-level recommendations (heuristic), not a contact database',
        competitor: varies(),
      },
      {
        dimension: 'Workflow/action depth',
        leadintel: 'Action center + saved briefs + webhooks/exports for handoff',
        competitor: varies(),
      },
      { dimension: 'Public pricing clarity', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Trust-center maturity', leadintel: 'Public trust pages', competitor: varies() },
      { dimension: 'Best-fit motion', leadintel: 'Outbound timing + execution', competitor: varies() },
    ],
    faqs: [
      { q: 'Is LeadIntel a data provider replacement?', a: 'No. LeadIntel is a signal-to-action workflow for outbound execution. If you need large-scale contact depth and buying groups, you may still use an enterprise data platform alongside it.' },
      { q: 'What does LeadIntel optimize for?', a: 'A daily shortlist, explainable scoring, and send-ready outreach tied to why-now signals.' },
      { q: 'Does LeadIntel have SSO/SAML?', a: 'Not as a generally available feature today. Use the Trust Center for what is implemented publicly.' },
      { q: 'How do I evaluate quickly?', a: 'Generate a sample digest without signup and review the workflow end-to-end.' },
      { q: 'Can I use both together?', a: 'Yes. Many teams use enterprise data for depth and LeadIntel for daily prioritization and messaging execution.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'Evaluate the why-now loop',
      bottomBody: 'Try the no-signup sample digest and see whether daily prioritization improves rep execution.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/trust',
      bottomSecondaryLabel: 'Trust Center',
    },
  },
  {
    slug: 'leadintel-vs-sales-navigator',
    competitorName: 'Sales Navigator',
    competitorType: 'LinkedIn-native research',
    bestFor: 'Best for: relationship context and LinkedIn-native research.',
    bestForSections: {
      leadintel: [
        'Teams who want a daily shortlist and why-now execution loop.',
        'Reps who want explainable scoring and send-ready drafts.',
        'Workflows that start from “what changed” and ship an action quickly.',
      ],
      competitor: [
        'Relationship-driven teams living inside LinkedIn messaging.',
        'Org mapping and profile/context research workflows.',
        'Prospecting and lead research inside LinkedIn. ' + varies() + '.',
      ],
    },
    title: 'LeadIntel vs Sales Navigator — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison: LinkedIn-native research and relationship context vs trigger-based daily prioritization and pitch drafts.',
    hero: {
      summary:
        'Sales Navigator is commonly used for LinkedIn-native research and account/lead context. LeadIntel is built for trigger-based alerts, a daily shortlist, and instant pitch drafts you can send.',
      atAGlance: {
        leadintelFocus: 'Trigger-based shortlist + send-ready drafts tied to “why now”.',
        competitorFocus: 'LinkedIn-native account/lead research and relationship context. ' + varies() + '.',
      },
    },
    useTogether: [
      'Use Sales Navigator for relationship/context research and org mapping.',
      'Use LeadIntel for daily timing signals and a short “who to contact today” list.',
      'Paste LeadIntel drafts into your messaging workflow (email, LinkedIn, sequences).',
    ],
    whoWins: {
      leadintel: [
        'You want daily prioritization from trigger signals.',
        'You want drafts you can send without starting from a blank page.',
        'You’re running a watchlist and want a short daily list.',
        'You want transparent scoring with reasons.',
        'You want a workflow that starts from “what changed” today.',
      ],
      competitor: [
        'You do heavy LinkedIn-native research and networking.',
        'Your motion relies on relationship mapping and mutual connections.',
        'You want to search and filter people/companies inside LinkedIn.',
        'You need a research surface more than a daily shortlist.',
        'Your timing signals live elsewhere and you just need context.',
      ],
    },
    whenLeadIntel: [
      'You’re optimizing for timing and actionability: who to contact today, and why.',
      'You want a tight loop to draft outreach quickly.',
      'You want watchlist-based monitoring rather than broad browsing.',
    ],
    whenCompetitor: [
      'Your workflow is relationship-driven and lives in LinkedIn.',
      'You need deep LinkedIn-specific context before you message.',
      'You’re primarily researching people and org structure.',
    ],
    checklist: [
      'Do you need a daily shortlist or a research surface?',
      'Do you need “why now” triggers or profile/company context?',
      'Do you want send-ready drafts or just information?',
      'Are you running a watchlist of target accounts?',
      'Is transparent scoring with reasons important?',
      'Do you already have a source of trigger signals?',
      'Will reps paste content into sequences elsewhere?',
      'Is your workflow primarily in LinkedIn messaging?',
      'Is the key pain “who do I message today?” or “who is this person?”',
      'Do you need a repeatable first-week workflow for new reps?',
      'Do you need team-wide template governance?',
      'Do you want the system to explain “why this account, today?”',
    ],
    migrationSteps: [
      'Define your ICP and the account list you care about.',
      'Use Sales Navigator for context (org, roles, relationship mapping) when needed.',
      'Use LeadIntel for daily trigger monitoring and a short prioritized list.',
      'Generate drafts and paste them into your LinkedIn/email workflow.',
      'Review outcomes weekly and refine angles/tokens for your ICP.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Signals → shortlist → draft outreach', competitor: 'LinkedIn-native research + outreach context (' + varies() + ')' },
      { dimension: 'Daily prioritization', leadintel: 'Yes', competitor: varies() },
      { dimension: '“Why now” signal layer', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Pitch draft generation', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: varies() },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: varies() },
      { dimension: 'Contact database / enrichment', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Sequencing', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Company intelligence depth', leadintel: 'Triggers + actionability', competitor: 'LinkedIn profile/company context (' + varies() + ')' },
      { dimension: 'Setup complexity', leadintel: 'Light', competitor: varies() },
      { dimension: 'Best-fit buyer', leadintel: 'Outbound teams who want daily “why now” execution', competitor: 'Teams doing heavy LinkedIn-native research (' + varies() + ')' },
    ],
    faqs: [
      { q: 'Can I use both together?', a: 'Yes. A common flow is: use LinkedIn for relationship/context, then use LeadIntel for timing, prioritization, and draft generation.' },
      { q: 'Will LeadIntel replace LinkedIn Sales Navigator?', a: 'Not if LinkedIn research is central to your motion. LeadIntel is built to decide who to touch today and generate a draft quickly.' },
      { q: 'What if I already have messaging sequences?', a: 'LeadIntel outputs can be pasted into your existing sequence steps. It’s designed to complement sequencing tools.' },
      { q: 'How does scoring work?', a: 'Deterministic 0–100 with reasons so reps can trust and learn the system.' },
      { q: 'What’s required to get value in week 1?', a: 'ICP + 10–25 target accounts. Then use the daily shortlist and draft generator for immediate “why now” outreach.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
  {
    slug: 'leadintel-vs-crunchbase',
    competitorName: 'Crunchbase',
    competitorType: 'Company + funding intelligence',
    bestFor: 'Best for: company/funding research and market mapping inputs.',
    bestForSections: {
      leadintel: [
        'Outbound teams who need why-now execution, not just research.',
        'Daily prioritization and explainable scoring for a defined watchlist.',
        'Send-ready drafts plus an action layer for downstream workflows.',
      ],
      competitor: [
        'Market mapping and company research (funding/firmographics).',
        'Building segments and lists from research inputs.',
        'Upstream intelligence work before execution. ' + varies() + '.',
      ],
    },
    title: 'LeadIntel vs Crunchbase — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison: company intelligence and funding context vs trigger-based daily prioritization and pitch drafts.',
    hero: {
      summary:
        'Crunchbase is commonly evaluated for company and funding intelligence. LeadIntel is built for daily trigger-based prioritization and instant outreach drafts tied to “why now”.',
      atAGlance: {
        leadintelFocus: 'Daily shortlist + drafts driven by trigger signals.',
        competitorFocus: 'Company and funding intelligence research. ' + varies() + '.',
      },
    },
    useTogether: [
      'Use Crunchbase for research and list building (companies, funding context, market mapping).',
      'Use LeadIntel to monitor your chosen targets for timing signals and decide who to contact today.',
      'Use LeadIntel drafts as the starting point, then add any research context you have.',
    ],
    whoWins: {
      leadintel: [
        'You want an execution loop, not just research.',
        'You care about recency and daily prioritization.',
        'You want drafts tied to signals and ICP.',
        'You want transparent scoring with reasons.',
        'You’re running account-based outbound.',
      ],
      competitor: [
        'You need a research surface for companies/funding.',
        'You’re building lists based on firmographic signals.',
        'You’re doing market mapping and monitoring broadly.',
        'You want to validate company context during research.',
        'You’re upstream of execution (research-first).',
      ],
    },
    whenLeadIntel: [
      'You already have target accounts and want daily action.',
      'You want to move from “signal” to “draft” fast.',
      'You prefer a narrow, repeatable workflow.',
    ],
    whenCompetitor: [
      'You’re doing market mapping and funding research.',
      'You want broad company intelligence as an input to targeting.',
      'You’re building lists and segments from scratch.',
    ],
    checklist: [
      'Do you need daily “who to contact” or research depth?',
      'Is the goal prioritization, or list building and segmentation?',
      'Do you need send-ready drafts?',
      'Is trigger recency and timing critical?',
      'Do you already have a watchlist?',
      'Do you want transparent scoring reasons?',
      'Where will outreach be executed (sequence tool, manual, CRM)?',
      'What does a successful week look like: better lists or more replies?',
      'Do you need to standardize messaging across reps?',
      'Do you need visible reasons behind a shortlist, not just data?',
      'Do you want signals tied to your targets (not broad search results)?',
      'Do you want value without building a new research process?',
    ],
    migrationSteps: [
      'Define your ICP and the segment you’re targeting.',
      'Build a list of 10–25 target accounts from your existing research inputs.',
      'Create a watchlist and review the daily shortlist on a fixed cadence.',
      'Use the templates/drafts to run a 7-day sequence; paste into your sequencer if you use one.',
      'Review results weekly and refine angles and tokens for your ICP.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Watchlist → shortlist → draft outreach', competitor: 'Company intelligence research (' + varies() + ')' },
      { dimension: 'Daily prioritization', leadintel: 'Yes', competitor: varies() },
      { dimension: '“Why now” signal layer', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Pitch draft generation', leadintel: 'Yes', competitor: varies() },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: varies() },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: varies() },
      { dimension: 'Contact database / enrichment', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Sequencing', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Company intelligence depth', leadintel: 'Action-oriented', competitor: varies() },
      { dimension: 'Setup complexity', leadintel: 'Light', competitor: varies() },
      { dimension: 'Best-fit buyer', leadintel: 'Outbound reps who need daily execution', competitor: 'Researchers and teams building segments/lists (' + varies() + ')' },
    ],
    faqs: [
      { q: 'Can I use both together?', a: 'Yes. Use Crunchbase-style research for list building, then use LeadIntel to prioritize daily touches and generate drafts.' },
      { q: 'Will LeadIntel replace Crunchbase?', a: 'Not if your core need is broad company intelligence research. LeadIntel is designed for daily execution on a defined target list.' },
      { q: 'What if I already have enrichment and firmographics?', a: 'Then LeadIntel can focus on timing + drafts. Keep your existing data sources and use LeadIntel for “what changed” execution.' },
      { q: 'How does scoring work?', a: 'Deterministic 0–100 scoring with reasons to help prioritize outreach.' },
      { q: 'What’s required to get value in week 1?', a: 'ICP + 10–25 accounts. You should get a daily shortlist and draft-ready outreach tied to signals.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
  {
    slug: 'leadintel-vs-google-alerts',
    competitorName: 'Google Alerts',
    competitorType: 'Keyword-based web alerts',
    bestFor: 'Best for: broad keyword monitoring and awareness.',
    bestForSections: {
      leadintel: [
        'Teams who want a watchlist-based daily shortlist and explainable scoring.',
        'Reps who need why-now context and send-ready drafts.',
        'Workflows that route action via webhooks/exports instead of copying links around.',
      ],
      competitor: [
        'Broad keyword/topic monitoring and awareness.',
        'Low-structure workflows that start from “read this later”.',
        'Situations where ranking, scoring, and drafts aren’t required.',
      ],
    },
    title: 'LeadIntel vs Google Alerts — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison: keyword-based web alerts vs watchlist-based daily prioritization and pitch drafts.',
    hero: {
      summary:
        'Google Alerts can be useful for keyword-based monitoring. LeadIntel is built for a daily shortlist for your target accounts, with scoring and send-ready drafts.',
      atAGlance: {
        leadintelFocus: 'Watchlist-driven shortlist + scoring + draft outreach.',
        competitorFocus: 'Keyword-based alerts across the web.',
      },
    },
    useTogether: [
      'Use Google Alerts for broad topic monitoring and awareness.',
      'Use LeadIntel for a watchlist-based daily shortlist tied to your targets.',
      'Use LeadIntel drafts to turn relevant signals into messages quickly.',
    ],
    whoWins: {
      leadintel: [
        'You care about a curated daily list of target accounts.',
        'You want prioritization and reasons—not just links.',
        'You want a “why now” summary you can send.',
        'You want drafts (email/DM/call opener) built in.',
        'You want account-based outbound execution.',
      ],
      competitor: [
        'You want broad keyword monitoring for free/low friction.',
        'You’re researching topics, not a specific account list.',
        'You just need a link to read later.',
        'Your outreach workflow is separate.',
        'You don’t need scoring or drafting.',
      ],
    },
    whenLeadIntel: [
      'You have a defined list of accounts and want daily prioritization.',
      'You want to turn signals into send-ready outreach quickly.',
      'You want transparent scoring and a consistent workflow.',
    ],
    whenCompetitor: [
      'You want broad topical monitoring.',
      'You’re early-stage and want zero-setup alerts.',
      'You don’t need a sales workflow—just awareness.',
    ],
    checklist: [
      'Do you need a daily shortlist of target accounts?',
      'Do you need reasons behind prioritization?',
      'Do you need “why now” context you can paste into outreach?',
      'Do you need drafts or just links?',
      'Do you want a watchlist-based workflow or broad keywords?',
      'Is timing/recency critical for replies?',
      'Do you need saved outputs and reuse?',
      'Do you need a repeatable daily routine?',
      'Do you need consistent outreach templates across reps?',
      'Do you need to route to the right owner quickly?',
      'Do you want signals tied to your ICP (not just keywords)?',
      'What does success look like: awareness or booked meetings?',
    ],
    migrationSteps: [
      'Define your ICP and the accounts you care about.',
      'Keep Google Alerts for broad monitoring if it helps your awareness.',
      'Create a watchlist and review LeadIntel’s daily shortlist on a cadence.',
      'Use templates and drafts to send first-touch and follow-ups consistently.',
      'Review outcomes weekly and refine angles and tokens.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Accounts → shortlist → draft outreach', competitor: 'Keyword alerts → read links' },
      { dimension: 'Daily prioritization', leadintel: 'Yes', competitor: 'No (alerts are not ranked for sales execution)' },
      { dimension: '“Why now” signal layer', leadintel: 'Yes (summarized)', competitor: 'Partial (depends on article quality)' },
      { dimension: 'Pitch draft generation', leadintel: 'Yes', competitor: 'No' },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: 'No' },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: 'No' },
      { dimension: 'Contact database / enrichment', leadintel: 'Not the core focus', competitor: 'No' },
      { dimension: 'Sequencing', leadintel: 'Not the core focus', competitor: 'No' },
      { dimension: 'Company intelligence depth', leadintel: 'Action-focused', competitor: 'Varies by search results' },
      { dimension: 'Setup complexity', leadintel: 'ICP + watchlist', competitor: 'Low (keywords)' },
      { dimension: 'Best-fit buyer', leadintel: 'Outbound reps running account-based plays', competitor: 'Anyone monitoring topics/keywords' },
    ],
    faqs: [
      { q: 'Can I use both together?', a: 'Yes. Use Google Alerts for broad topics, and LeadIntel for a daily shortlist tied to your targets and outreach drafts.' },
      { q: 'Will LeadIntel replace Google Alerts?', a: 'If you only want keyword monitoring, no. If you want a sales workflow that turns signals into action, LeadIntel is a better fit.' },
      { q: 'What if I already do manual research from alerts?', a: 'LeadIntel’s value is prioritization + drafting. It reduces the time from “I saw a signal” to “I sent a message.”' },
      { q: 'How does scoring work?', a: 'LeadIntel uses deterministic 0–100 scoring with reasons so you can prioritize quickly.' },
      { q: 'What’s required to get value in week 1?', a: 'Define your ICP and add 10–25 accounts. Then use the daily shortlist and drafts.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
  {
    slug: 'leadintel-vs-manual-research',
    competitorName: 'Manual research',
    competitorType: 'Tabs + ad hoc notes',
    bestFor: 'Best for: low-volume, bespoke outreach where time is not the bottleneck.',
    bestForSections: {
      leadintel: [
        'Teams who need consistent daily prioritization and repeatable execution.',
        'Reps who want explainable scoring and send-ready drafts as a baseline.',
        'Workflows that need an action layer (push/export) rather than manual copy/paste.',
      ],
      competitor: [
        'Very low-volume, bespoke accounts where time is not the bottleneck.',
        'Research-heavy motions where each account is a project.',
        'Situations where consistency and scale are not required.',
      ],
    },
    title: 'LeadIntel vs manual research — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison: manual tab-based research vs a repeatable daily shortlist and draft workflow.',
    hero: {
      summary:
        'Manual research works, but it is hard to keep consistent and easy to over-invest in low-intent accounts. LeadIntel is built to standardize daily prioritization and draft generation.',
      atAGlance: {
        leadintelFocus: 'Repeatable daily routine with scoring + drafts.',
        competitorFocus: 'Ad hoc research and messaging built from scratch.',
      },
    },
    useTogether: [
      'Use manual research when an account is truly high stakes and needs bespoke context.',
      'Use LeadIntel to standardize daily prioritization so research time is spent on the right accounts.',
      'Use LeadIntel drafts as the starting point, then add your research where it matters.',
    ],
    whoWins: {
      leadintel: [
        'You want consistency across days and reps.',
        'You want a daily shortlist instead of an endless backlog.',
        'You want reasons behind prioritization.',
        'You want drafts you can reuse and iterate.',
        'You want watchlist-based execution.',
      ],
      competitor: [
        'You only target a few accounts and enjoy deep custom research.',
        'You don’t need a consistent daily routine.',
        'You prefer bespoke messaging every time.',
        'Your timing signals are obvious and rare.',
        'You don’t need saved outputs or templates.',
      ],
    },
    whenLeadIntel: [
      'You want a consistent “who to touch today” routine.',
      'You want to reduce time spent on low-leverage research.',
      'You want reusable outputs and a tighter loop.',
    ],
    whenCompetitor: [
      'Your volume is low and each account is a bespoke project.',
      'You prefer a fully manual workflow and don’t need speed.',
      'You have a strong internal research process already.',
    ],
    checklist: [
      'Do you lose time deciding who to contact today?',
      'Do you need a repeatable daily routine?',
      'Do you want draft outputs you can save and reuse?',
      'Do you need transparent scoring reasons?',
      'Is your watchlist stable and intentional?',
      'Are you spending time researching accounts that never respond?',
      'Do you need a system that scales to more accounts?',
      'Do you want to standardize execution across a team?',
      'Do you want consistent follow-ups without rewriting from scratch?',
      'Do you need a way to explain “why now” to new reps?',
      'Do you want a tight first-week workflow (ICP → watchlist → shortlist → outreach)?',
      'What does success look like: more depth or more consistent output?',
    ],
    migrationSteps: [
      'Define your ICP and create a stable watchlist of target accounts.',
      'Review the daily shortlist on a fixed cadence (keep it short).',
      'Use drafts/templates as the starting point; add deep research only where it changes the outcome.',
      'Run a 7-day sequence and keep notes on objections and patterns.',
      'Refine tokens and angles weekly so output improves over time.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Signals → shortlist → drafts', competitor: 'Research → write from scratch → repeat' },
      { dimension: 'Daily prioritization', leadintel: 'Yes', competitor: 'Manual and inconsistent' },
      { dimension: '“Why now” signal layer', leadintel: 'Built-in', competitor: 'Depends on your research' },
      { dimension: 'Pitch draft generation', leadintel: 'Built-in', competitor: 'Manual' },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: 'Manual routing' },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: 'Manual' },
      { dimension: 'Contact database / enrichment', leadintel: 'Not the core focus', competitor: 'Manual sourcing' },
      { dimension: 'Sequencing', leadintel: 'Not the core focus', competitor: 'Manual or separate tools' },
      { dimension: 'Company intelligence depth', leadintel: 'Action-focused', competitor: 'As deep as you have time for' },
      { dimension: 'Setup complexity', leadintel: 'Light', competitor: 'High ongoing effort' },
      { dimension: 'Best-fit buyer', leadintel: 'Teams who want speed + consistency', competitor: 'Low-volume bespoke outreach' },
    ],
    faqs: [
      { q: 'Can I still do manual research with LeadIntel?', a: 'Yes. LeadIntel doesn’t block deep research—it gives you a daily starting point, and a draft you can refine.' },
      { q: 'Will LeadIntel replace my process?', a: 'It depends. If your current process is working, use LeadIntel to standardize prioritization and reduce blank-page writing.' },
      { q: 'What if I already have my own templates?', a: 'Keep them. LeadIntel can generate drafts that match your tone, and you can save/reuse outputs.' },
      { q: 'How does scoring work?', a: 'Deterministic 0–100 with reasons so you can trust the prioritization.' },
      { q: 'What’s required to get value in week 1?', a: 'ICP + 10–25 accounts. Then use the daily shortlist and draft generator.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
  {
    slug: 'leadintel-vs-spreadsheets',
    competitorName: 'Spreadsheets',
    competitorType: 'Manual tracking',
    bestFor: 'Best for: small lists and simple tracking when automation isn’t required.',
    bestForSections: {
      leadintel: [
        'Teams who want why-now prioritization rather than manual tracking.',
        'Reps who want explainable scoring and send-ready drafts built in.',
        'Workflows that need webhooks/exports to route actions.',
      ],
      competitor: [
        'Tiny lists and simple tracking fields.',
        'Manual updates where automation is not required.',
        'Lightweight tracking artifacts with no drafting or scoring.',
      ],
    },
    title: 'LeadIntel vs spreadsheets — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison: spreadsheets for tracking vs a workflow that turns timing signals into daily prioritization and drafts.',
    hero: {
      summary:
        'Spreadsheets can work for tracking a list, but they don’t detect timing signals or generate outreach. LeadIntel is built for watchlist monitoring, daily prioritization, and send-ready drafts.',
      atAGlance: {
        leadintelFocus: 'Signals → shortlist → drafts (repeatable daily routine).',
        competitorFocus: 'Manual tracking and updates. ' + varies() + '.',
      },
    },
    useTogether: [
      'Use a spreadsheet as a simple “source list” if that’s your team habit.',
      'Use LeadIntel to monitor those accounts for timing signals and generate a daily shortlist.',
      'Use LeadIntel drafts to standardize outreach so the sheet isn’t where messaging lives.',
    ],
    whoWins: {
      leadintel: [
        'You want timing signals without manual checking.',
        'You want a daily shortlist with reasons.',
        'You want send-ready drafts for first-touch and follow-ups.',
        'You want consistent execution across reps.',
        'You want outputs you can save and reuse.',
      ],
      competitor: [
        'You have a very small list and can update it manually.',
        'You only need basic tracking fields.',
        'You don’t need a daily routine or “why now” signals.',
        'You prefer to write messaging from scratch every time.',
        'You don’t need drafting or scoring.',
      ],
    },
    whenLeadIntel: [
      'You’re running account-based outbound and need daily prioritization.',
      'You want a repeatable workflow that produces drafts quickly.',
      'You want a consistent cadence and saved outputs.',
    ],
    whenCompetitor: [
      'Your list is tiny and updates are infrequent.',
      'You only need a lightweight tracking artifact.',
      'You don’t need a standardized execution workflow.',
    ],
    checklist: [
      'Do you need timing signals or just a tracking list?',
      'Do you lose time deciding who to contact today?',
      'Do you need reasons behind prioritization?',
      'Do you need send-ready drafts or just notes?',
      'Do you need a repeatable daily routine?',
      'Do you want consistent follow-ups without rewriting?',
      'Do you need outputs you can save and reuse?',
      'Do you want to standardize execution across reps?',
      'Is your watchlist stable and intentional?',
      'Do you need to route to the right owner quickly?',
      'Do you want “why now” context tied to your ICP?',
      'What does success look like: tracking completeness or booked meetings?',
    ],
    migrationSteps: [
      'Define your ICP and create a watchlist (start with your spreadsheet if you have one).',
      'Import or add 10–25 target accounts to monitor.',
      'Review the daily shortlist and pick a small outreach block each day.',
      'Use templates/drafts for first-touch and follow-ups; paste into your sequencer if you use one.',
      'Refine tokens and angles weekly based on what gets replies.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Signals → shortlist → drafts', competitor: 'Track list manually (' + varies() + ')' },
      { dimension: 'Daily prioritization', leadintel: 'Yes (reasons + shortlist)', competitor: 'Manual' },
      { dimension: '“Why now” signal layer', leadintel: 'Yes', competitor: 'No' },
      { dimension: 'Pitch draft generation', leadintel: 'Yes', competitor: 'No' },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: varies() },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: varies() },
      { dimension: 'Sharing + collaboration', leadintel: varies(), competitor: varies() },
      { dimension: 'Setup complexity', leadintel: 'Light: ICP + watchlist', competitor: 'Low, but ongoing manual upkeep' },
      { dimension: 'Best-fit buyer', leadintel: 'Teams who want speed + consistency', competitor: 'Small lists and simple tracking' },
    ],
    faqs: [
      { q: 'Can I start from a spreadsheet?', a: 'Yes. Many teams start with a sheet for the initial account list, then use LeadIntel for monitoring, prioritization, and drafts.' },
      { q: 'Will LeadIntel replace spreadsheets entirely?', a: 'Not necessarily. If your team likes a sheet as a lightweight list, keep it. LeadIntel is meant to drive the daily execution workflow.' },
      { q: 'What if we already track fields and notes in a sheet?', a: 'Keep those if they’re useful. LeadIntel adds timing signals, a daily shortlist, and drafting to reduce blank-page work.' },
      { q: 'How does scoring work?', a: 'LeadIntel uses a deterministic 0–100 score with visible reasons so you can trust the prioritization.' },
      { q: 'What’s required to get value in week 1?', a: 'Define your ICP, add 10–25 accounts, then use the daily shortlist and templates/drafts for consistent outreach.' },
    ],
    ctas: {
      primaryHref: '/#try-sample',
      primaryLabel: 'Generate a sample digest',
      secondaryHref: '/pricing',
      secondaryLabel: 'See pricing',
      bottomTitle: 'See it with your targets',
      bottomBody: 'Generate a sample digest, then decide if daily “why now” prioritization fits your motion.',
      bottomPrimaryHref: '/#try-sample',
      bottomPrimaryLabel: 'Generate a sample digest',
      bottomSecondaryHref: '/templates',
      bottomSecondaryLabel: 'Browse templates',
    },
  },
]

