export type CompareTableRow = {
  dimension: string
  leadintel: string
  competitor: string
}

export type CompareFaq = { q: string; a: string }

export type ComparePage = {
  slug: string
  competitorName: string
  competitorType: string
  bestFor: string
  bestForSections?: { leadintel: string[]; competitor: string[] }
  title: string
  description: string
  hero: {
    summary: string
    atAGlance: { leadintelFocus: string; competitorFocus: string }
  }
  useTogether: string[]
  whoWins: { leadintel: string[]; competitor: string[] }
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

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: 'leadintel-vs-apollo',
    competitorName: 'Apollo',
    competitorType: 'Prospecting + outbound tooling',
    bestFor: 'Best for: contact discovery + list building workflows.',
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
    title: 'LeadIntel vs Apollo — Trigger-based alerts and instant pitch drafts',
    description:
      'A conservative comparison focused on workflow fit: daily trigger-based prioritization vs prospecting and outbound tooling.',
    hero: {
      summary:
        'Apollo is commonly evaluated for prospecting and outbound tooling. LeadIntel is built for trigger-based account alerts, a daily shortlist, and instant pitch drafts.',
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
      'Use the templates and pitch drafts for first-touch and follow-ups; paste into your sequencer if you use one.',
      'Review outcomes weekly and refine the angles/tokens for your ICP.',
    ],
    table: [
      { dimension: 'Primary workflow', leadintel: 'Account watchlist → daily shortlist → draft outreach', competitor: 'Prospecting + outbound workflow (' + varies() + ')' },
      { dimension: 'Daily prioritization', leadintel: 'Yes (shortlist + score)', competitor: varies() },
      { dimension: '“Why now” signal layer', leadintel: 'Yes (trigger-based context)', competitor: varies() },
      { dimension: 'Pitch draft generation', leadintel: 'Yes (email/DM/call openers)', competitor: varies() },
      { dimension: 'Action layer (webhooks / exports)', leadintel: 'Yes (webhooks + exports)', competitor: varies() },
      { dimension: 'Team governance (approvals + audit logs)', leadintel: 'Yes (Team plan)', competitor: varies() },
      { dimension: 'Contact database / enrichment', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Sequencing', leadintel: 'Not the core focus', competitor: varies() },
      { dimension: 'Company intelligence depth', leadintel: 'Focused on triggers + actionability', competitor: varies() },
      { dimension: 'Setup complexity', leadintel: 'Light: ICP + watchlist', competitor: varies() },
      { dimension: 'Best-fit buyer', leadintel: 'Outbound SDRs/AEs running account-based plays', competitor: 'Teams optimizing prospecting + outbound tooling (' + varies() + ')' },
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

