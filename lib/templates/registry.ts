export type TemplateChannel = 'email' | 'linkedin' | 'call'

export type TemplateTrigger =
  | 'funding'
  | 'hiring_spike'
  | 'partnership'
  | 'product_launch'
  | 'competitive_displacement'
  | 'expansion'

export type TemplateLength = 'short' | 'medium' | 'breakup' | 'ultra_short' | 'value' | 'opener'

export type TemplateTokenDef = {
  token: string
  meaning: string
  how: string
}

export type OutreachTemplate = {
  slug: string
  trigger: TemplateTrigger
  channel: TemplateChannel
  persona: 'sdr_ae'
  length: TemplateLength
  title: string
  tags: string[]
  tokens: string[]
  related_use_case_path: string
  body: string
}

function listTokens(body: string): string[] {
  const set = new Set<string>()
  const re = /\{\{[a-z0-9_]+\}\}/gi
  for (const m of body.matchAll(re)) {
    set.add(m[0].toLowerCase())
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function t(template: Omit<OutreachTemplate, 'tokens'>): OutreachTemplate {
  return { ...template, tokens: listTokens(template.body) }
}

export const TEMPLATE_TOKENS: TemplateTokenDef[] = [
  { token: '{{company}}', meaning: 'Target account', how: 'Company name (or domain if you prefer).' },
  { token: '{{trigger}}', meaning: 'Why now signal', how: 'Funding, hiring spike, partnership, product launch, expansion, renewal window.' },
  { token: '{{initiative}}', meaning: 'Likely priority', how: 'One initiative tied to the trigger (pipeline, enablement, reporting, security, expansion).' },
  { token: '{{alt_initiative}}', meaning: 'Alternative priority', how: 'A credible alternative so the question is easy to answer.' },
  { token: '{{alt_owner}}', meaning: 'Alternate owner', how: 'Likely owner: RevOps, Enablement, SDR leader, VP Sales, Partnerships, Product.' },
  { token: '{{name}}', meaning: 'Contact first name', how: 'First name only.' },
  { token: '{{role}}', meaning: 'Role being hired', how: 'Use the most specific role posted.' },
  { token: '{{function}}', meaning: 'Function hiring', how: 'The function (GTM, RevOps, Security, Product).' },
  { token: '{{timeframe}}', meaning: 'Decision window', how: '“30 days”, “this quarter”, “next 60 days”.' },
  { token: '{{bottleneck}}', meaning: 'Post-change bottleneck', how: 'Pick one: onboarding, reporting, enablement, support, pipeline.' },
  { token: '{{partner}}', meaning: 'Partner name', how: 'The partner from the announcement.' },
  { token: '{{stage}}', meaning: 'Rollout stage', how: 'Pilot vs GA. If unknown, ask as the first question.' },
  { token: '{{handoff}}', meaning: 'Concrete handoff', how: 'Routing, reporting, onboarding, enablement, data sync.' },
  { token: '{{system_a}}', meaning: 'System/process A', how: 'One side of the handoff.' },
  { token: '{{system_b}}', meaning: 'System/process B', how: 'The other side of the handoff.' },
  { token: '{{vendor}}', meaning: 'Incumbent vendor', how: 'Keep it factual; avoid trash-talking.' },
  { token: '{{workflow}}', meaning: 'Workflow in evaluation', how: 'What they’re evaluating (prioritization, enablement, reporting).' },
  { token: '{{region_or_segment}}', meaning: 'Expansion target', how: 'Region or segment they’re expanding into.' },
  { token: '{{pain}}', meaning: 'Scaling pain', how: 'Pick one: handoffs, reporting, enablement, onboarding.' },
]

export const TEMPLATE_LIBRARY: OutreachTemplate[] = [
  // Funding outreach (7)
  t({
    slug: 'funding-email-1-short',
    trigger: 'funding',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Funding — cold email #1 (short)',
    tags: ['funding', 'email', 'short', 'why_now'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Subject: Quick question after {{trigger}}\n\nCongrats on {{trigger}} at {{company}} — are you prioritizing {{initiative}} in the next {{timeframe}}?\n\nIf yes, I can share a short checklist to turn “why now” signals into daily priorities + a send-ready draft.\n\nWorth a quick 10 minutes?',
  }),
  t({
    slug: 'funding-email-2-medium',
    trigger: 'funding',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Funding — cold email #2 (medium)',
    tags: ['funding', 'email', 'medium', 'checklist'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Subject: 1 idea for the first 30 days after {{trigger}}\n\nCongrats on {{trigger}} at {{company}}.\n\nIn the first 30 days, teams usually pick 1–2 execution projects (pipeline coverage, enablement, tooling, reporting).\n\nIf {{initiative}} is on the roadmap, we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- draft outreach you can send in minutes\n\nAre you the right owner for this, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'funding-email-3-breakup',
    trigger: 'funding',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Funding — cold email #3 (breakup)',
    tags: ['funding', 'email', 'breakup'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf {{initiative}} isn’t a priority after {{trigger}}, no problem — I can reach back out later when timing changes.',
  }),
  t({
    slug: 'funding-linkedin-1-ultra-short',
    trigger: 'funding',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Funding — LinkedIn DM #1 (ultra short)',
    tags: ['funding', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/funding-outreach',
    body: 'Congrats on {{trigger}} at {{company}} — quick question: is the priority this quarter {{initiative}} or {{alt_initiative}}?',
  }),
  t({
    slug: 'funding-linkedin-2-value',
    trigger: 'funding',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Funding — LinkedIn DM #2 (value + question)',
    tags: ['funding', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Congrats on {{trigger}} at {{company}}.\n\nIf you’re tackling {{initiative}}, I can share a short checklist for turning triggers into a daily shortlist + a send-ready draft.\n\nWant it?',
  }),
  t({
    slug: 'funding-call-1-opener',
    trigger: 'funding',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Funding — call opener #1',
    tags: ['funding', 'call', 'opener'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Hey {{name}} — congrats on {{trigger}} at {{company}}. Quick question: what initiative is highest priority in the next {{timeframe}} — pipeline, enablement, or ops tooling?',
  }),
  t({
    slug: 'funding-call-2-opener',
    trigger: 'funding',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Funding — call opener #2',
    tags: ['funding', 'call', 'opener', 'owner'],
    related_use_case_path: '/use-cases/funding-outreach',
    body:
      'Hi {{name}} — calling because after {{trigger}} messaging can get inconsistent. Are you the owner for outbound execution, or is that {{alt_owner}}?',
  }),

  // Hiring spike (7)
  t({
    slug: 'hiring-spike-email-1-short',
    trigger: 'hiring_spike',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Hiring spike — cold email #1 (short)',
    tags: ['hiring_spike', 'email', 'short', 'why_now'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Subject: Quick question on the hiring push\n\nNoticed you’re hiring for {{role}} at {{company}}.\n\nIs that role tied to {{initiative}} or {{alt_initiative}}?\n\nIf yes, I can share a short checklist to turn triggers into daily priorities + a send-ready draft.\n\nWorth 10 minutes?',
  }),
  t({
    slug: 'hiring-spike-email-2-medium',
    trigger: 'hiring_spike',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Hiring spike — cold email #2 (medium)',
    tags: ['hiring_spike', 'email', 'medium'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Subject: 1 idea while you’re scaling the team\n\nSaw the hiring spike in {{function}} (especially {{role}}).\n\nWhen teams scale, the pain usually shows up in one place first: prioritization, enablement, or reporting.\n\nIf you’re working on {{initiative}}, we can help your reps:\n- get trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts they can send in minutes\n\nAre you the right owner, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'hiring-spike-email-3-breakup',
    trigger: 'hiring_spike',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Hiring spike — cold email #3 (breakup)',
    tags: ['hiring_spike', 'email', 'breakup'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf the hiring isn’t related to {{initiative}}, no problem — I can reach back out later when timing changes.',
  }),
  t({
    slug: 'hiring-spike-linkedin-1-ultra-short',
    trigger: 'hiring_spike',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Hiring spike — LinkedIn DM #1 (ultra short)',
    tags: ['hiring_spike', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/hiring-spike',
    body: 'Saw you’re hiring for {{role}} — is that tied to {{initiative}} at {{company}}?',
  }),
  t({
    slug: 'hiring-spike-linkedin-2-value',
    trigger: 'hiring_spike',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Hiring spike — LinkedIn DM #2 (value + question)',
    tags: ['hiring_spike', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Hiring spikes usually mean a build phase.\n\nIf you’re scaling {{function}} at {{company}}, I can share a short checklist for turning triggers into daily priorities + a send-ready draft.\n\nWant it?',
  }),
  t({
    slug: 'hiring-spike-call-1-opener',
    trigger: 'hiring_spike',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Hiring spike — call opener #1',
    tags: ['hiring_spike', 'call', 'opener'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Hey {{name}} — calling because I noticed the hiring spike in {{function}} at {{company}}. Quick question: is the focus right now {{initiative}} or {{alt_initiative}}?',
  }),
  t({
    slug: 'hiring-spike-call-2-opener',
    trigger: 'hiring_spike',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Hiring spike — call opener #2',
    tags: ['hiring_spike', 'call', 'opener', 'owner'],
    related_use_case_path: '/use-cases/hiring-spike',
    body:
      'Hi {{name}} — when teams hire fast, messaging consistency usually breaks. Are you the owner for enablement/outbound execution, or is that {{alt_owner}}?',
  }),

  // Partnership announcement (7)
  t({
    slug: 'partnership-email-1-short',
    trigger: 'partnership',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Partnership — cold email #1 (short)',
    tags: ['partnership', 'email', 'short', 'rollout'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Subject: Quick question on the partnership rollout\n\nSaw the {{partner}} announcement — congrats.\n\nAre you already planning how teams will handle {{handoff}} between {{system_a}} and {{system_b}} at {{company}}?\n\nIf helpful, I can share a short rollout checklist.\n\nWorth 10 minutes?',
  }),
  t({
    slug: 'partnership-email-2-medium',
    trigger: 'partnership',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Partnership — cold email #2 (medium)',
    tags: ['partnership', 'email', 'medium', 'rollout'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Subject: Prevent rollout friction (partnership)\n\nCongrats on the {{partner}} announcement.\n\nIn rollouts like this, friction usually shows up in 3 places:\n1) ownership (who does what)\n2) reporting (what gets measured)\n3) enablement (how reps message it)\n\nIf you’re in {{stage}} (pilot/GA), we can help your team prioritize accounts and generate a “why now” draft you can send fast.\n\nAre you the right owner, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'partnership-email-3-breakup',
    trigger: 'partnership',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Partnership — cold email #3 (breakup)',
    tags: ['partnership', 'email', 'breakup'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf the partnership rollout isn’t a focus right now, no problem — I can reach back out later.',
  }),
  t({
    slug: 'partnership-linkedin-1-ultra-short',
    trigger: 'partnership',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Partnership — LinkedIn DM #1 (ultra short)',
    tags: ['partnership', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body: 'Congrats on the {{partner}} announcement — are you in pilot or GA right now?',
  }),
  t({
    slug: 'partnership-linkedin-2-value',
    trigger: 'partnership',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Partnership — LinkedIn DM #2 (value + question)',
    tags: ['partnership', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Partnership rollouts usually break handoffs + reporting.\n\nIf you want, I can share a short rollout checklist and how teams prioritize the right accounts during the rollout.\n\nWant it?',
  }),
  t({
    slug: 'partnership-call-1-opener',
    trigger: 'partnership',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Partnership — call opener #1',
    tags: ['partnership', 'call', 'opener'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Hey {{name}} — quick question on the {{partner}} rollout: are you in pilot or GA, and who owns the {{handoff}} between {{system_a}} and {{system_b}}?',
  }),
  t({
    slug: 'partnership-call-2-opener',
    trigger: 'partnership',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Partnership — call opener #2',
    tags: ['partnership', 'call', 'opener', 'enablement'],
    related_use_case_path: '/use-cases/partnership-announcement',
    body:
      'Hi {{name}} — partnerships often create enablement drift. Are you the owner for messaging/templates, or is that {{alt_owner}}?',
  }),

  // Product launch timing (7)
  t({
    slug: 'product-launch-email-1-short',
    trigger: 'product_launch',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Product launch — cold email #1 (short)',
    tags: ['product_launch', 'email', 'short', 'post-ga'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Subject: Quick question post‑launch\n\nCongrats on the launch at {{company}}.\n\nWhat’s the biggest bottleneck in the first 30 days post‑GA — onboarding, reporting, enablement, or support?\n\nIf it’s {{bottleneck}}, I can share a short checklist to reduce friction.\n\nWorth 10 minutes?',
  }),
  t({
    slug: 'product-launch-email-2-medium',
    trigger: 'product_launch',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Product launch — cold email #2 (medium)',
    tags: ['product_launch', 'email', 'medium'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Subject: 1 idea for the 30 days post‑GA\n\nCongrats on shipping.\n\nAfter GA, teams usually do two things at once: fix friction and scale outbound messaging.\n\nIf you’re working on {{bottleneck}}, we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts you can send in minutes\n\nAre you the owner for this, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'product-launch-email-3-breakup',
    trigger: 'product_launch',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Product launch — cold email #3 (breakup)',
    tags: ['product_launch', 'email', 'breakup'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf post‑launch priorities are elsewhere right now, no problem — I can reach back out later.',
  }),
  t({
    slug: 'product-launch-linkedin-1-ultra-short',
    trigger: 'product_launch',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Product launch — LinkedIn DM #1 (ultra short)',
    tags: ['product_launch', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body: 'Congrats on the launch — what’s the biggest bottleneck in the 30 days post‑GA?',
  }),
  t({
    slug: 'product-launch-linkedin-2-value',
    trigger: 'product_launch',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Product launch — LinkedIn DM #2 (value + question)',
    tags: ['product_launch', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Post‑GA, teams usually fix friction + update messaging.\n\nIf you want, I can share a short checklist for {{bottleneck}} and how teams prioritize the right accounts with “why now” context.\n\nWant it?',
  }),
  t({
    slug: 'product-launch-call-1-opener',
    trigger: 'product_launch',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Product launch — call opener #1',
    tags: ['product_launch', 'call', 'opener'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Hey {{name}} — congrats on the launch at {{company}}. Quick question: what’s the biggest bottleneck you’re fixing first post‑GA — onboarding, reporting, enablement, or support?',
  }),
  t({
    slug: 'product-launch-call-2-opener',
    trigger: 'product_launch',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Product launch — call opener #2',
    tags: ['product_launch', 'call', 'opener', 'enablement'],
    related_use_case_path: '/use-cases/product-launch-timing',
    body:
      'Hi {{name}} — after GA, messaging often drifts across reps. Are you the owner for enablement/outbound execution, or is that {{alt_owner}}?',
  }),

  // Competitive displacement (7)
  t({
    slug: 'competitive-displacement-email-1-short',
    trigger: 'competitive_displacement',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Competitive displacement — cold email #1 (short)',
    tags: ['competitive_displacement', 'email', 'short', 'checklist'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'Subject: Quick evaluation checklist\n\nIf you’re evaluating alternatives to {{vendor}}, here’s a simple checklist to decide fast:\n1) must-have requirements\n2) rollout + adoption risk\n3) reporting + maintenance\n\nWant the 1‑page version?',
  }),
  t({
    slug: 'competitive-displacement-email-2-medium',
    trigger: 'competitive_displacement',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Competitive displacement — cold email #2 (medium)',
    tags: ['competitive_displacement', 'email', 'medium'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'Subject: Shortlist → pilot decision points\n\nIf you’re moving from research → shortlist → pilot for {{workflow}}, the fastest path is to agree on:\n- what “good” looks like (success criteria)\n- rollout risk (who adopts + how)\n- reporting/maintenance (what breaks over time)\n\nIf you want, I can share a 1‑page battlecard-style checklist and a pilot plan.\n\nAre you the right owner, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'competitive-displacement-email-3-breakup',
    trigger: 'competitive_displacement',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Competitive displacement — cold email #3 (breakup)',
    tags: ['competitive_displacement', 'email', 'breakup'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf you’re not evaluating alternatives to {{vendor}} right now, no problem — I can reach back out later.',
  }),
  t({
    slug: 'competitive-displacement-linkedin-1-ultra-short',
    trigger: 'competitive_displacement',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Competitive displacement — LinkedIn DM #1 (ultra short)',
    tags: ['competitive_displacement', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body: 'If you’re evaluating alternatives to {{vendor}}, want a 1‑page decision checklist?',
  }),
  t({
    slug: 'competitive-displacement-linkedin-2-value',
    trigger: 'competitive_displacement',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Competitive displacement — LinkedIn DM #2 (value + question)',
    tags: ['competitive_displacement', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'When teams displace a vendor, timelines slip because requirements and rollout risk aren’t pinned down.\n\nIf helpful, I can share a short checklist + pilot plan.\n\nWant it?',
  }),
  t({
    slug: 'competitive-displacement-call-1-opener',
    trigger: 'competitive_displacement',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Competitive displacement — call opener #1',
    tags: ['competitive_displacement', 'call', 'opener'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'Hey {{name}} — quick question: are you in research, shortlist, or pilot for {{workflow}}? I’ll keep this tight.',
  }),
  t({
    slug: 'competitive-displacement-call-2-opener',
    trigger: 'competitive_displacement',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Competitive displacement — call opener #2',
    tags: ['competitive_displacement', 'call', 'opener', 'owner'],
    related_use_case_path: '/use-cases/competitive-displacement',
    body:
      'Hi {{name}} — when teams displace a vendor, the decision usually hinges on rollout risk and reporting. Who owns evaluation on your side — you or {{alt_owner}}?',
  }),

  // Expansion signals (7)
  t({
    slug: 'expansion-email-1-short',
    trigger: 'expansion',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'short',
    title: 'Expansion — cold email #1 (short)',
    tags: ['expansion', 'email', 'short', 'why_now'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Subject: Quick question on expansion\n\nWhen teams expand into {{region_or_segment}}, the first pain usually shows up in {{pain}} (handoffs/reporting/enablement).\n\nIs that on your radar right now at {{company}}?\n\nIf yes, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWorth 10 minutes?',
  }),
  t({
    slug: 'expansion-email-2-medium',
    trigger: 'expansion',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'medium',
    title: 'Expansion — cold email #2 (medium)',
    tags: ['expansion', 'email', 'medium'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Subject: Standardize outbound during expansion\n\nSaw the expansion into {{region_or_segment}}.\n\nIn growth phases, execution drifts fast: different reps, different messages, inconsistent prioritization.\n\nIf you’re working on {{pain}}, we can help your team:\n- spot trigger-based account alerts\n- prioritize the day’s list with a 0–100 score\n- generate outreach drafts you can send in minutes\n\nAre you the right owner, or should I ask {{alt_owner}}?',
  }),
  t({
    slug: 'expansion-email-3-breakup',
    trigger: 'expansion',
    channel: 'email',
    persona: 'sdr_ae',
    length: 'breakup',
    title: 'Expansion — cold email #3 (breakup)',
    tags: ['expansion', 'email', 'breakup'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf expansion isn’t a priority right now, no problem — I can reach back out later.',
  }),
  t({
    slug: 'expansion-linkedin-1-ultra-short',
    trigger: 'expansion',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'ultra_short',
    title: 'Expansion — LinkedIn DM #1 (ultra short)',
    tags: ['expansion', 'linkedin', 'ultra-short'],
    related_use_case_path: '/use-cases/expansion-signals',
    body: 'Expansion into {{region_or_segment}} — quick question: what’s the #1 scaling pain right now?',
  }),
  t({
    slug: 'expansion-linkedin-2-value',
    trigger: 'expansion',
    channel: 'linkedin',
    persona: 'sdr_ae',
    length: 'value',
    title: 'Expansion — LinkedIn DM #2 (value + question)',
    tags: ['expansion', 'linkedin', 'value'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Expansion usually exposes friction in handoffs/reporting/enablement.\n\nIf helpful, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWant it?',
  }),
  t({
    slug: 'expansion-call-1-opener',
    trigger: 'expansion',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Expansion — call opener #1',
    tags: ['expansion', 'call', 'opener'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Hey {{name}} — quick question on the expansion into {{region_or_segment}}: what’s the biggest bottleneck right now — handoffs, reporting, or enablement?',
  }),
  t({
    slug: 'expansion-call-2-opener',
    trigger: 'expansion',
    channel: 'call',
    persona: 'sdr_ae',
    length: 'opener',
    title: 'Expansion — call opener #2',
    tags: ['expansion', 'call', 'opener', 'enablement'],
    related_use_case_path: '/use-cases/expansion-signals',
    body:
      'Hi {{name}} — during expansion, outbound execution often drifts across reps. Are you the owner for enablement/outbound execution, or is that {{alt_owner}}?',
  }),
]

export function getTemplateBySlug(slug: string): OutreachTemplate | null {
  const s = slug.trim().toLowerCase()
  return TEMPLATE_LIBRARY.find((x) => x.slug === s) ?? null
}

export function getTokenGlossaryForTemplate(template: OutreachTemplate): TemplateTokenDef[] {
  const set = new Set(template.tokens.map((t) => t.toLowerCase()))
  return TEMPLATE_TOKENS.filter((d) => set.has(d.token.toLowerCase()))
}

