export type PlaybookAngle = { title: string; detail: string }

export type SequencePackItem = {
  day: string
  label: string
  templateSlug: string
}

export type ObjectionHandlingItem = {
  objection: string
  response: string
}

export type PersonalizationExample = {
  label: string
  example: string
}

export type UseCasePlaybook = {
  slug:
    | 'funding-outreach'
    | 'hiring-spike'
    | 'product-launch-timing'
    | 'partnership-announcement'
    | 'competitive-displacement'
    | 'expansion-signals'
  title: string
  subtitle: string
  promise: string
  whenWorksBest: string[]
  timingSignals: string[]
  angles: PlaybookAngle[]
  sequencePack: SequencePackItem[]
  objections: ObjectionHandlingItem[]
  personalizationExamples: PersonalizationExample[]
  related: { href: string; label: string }[]
}

export const USE_CASE_PLAYBOOKS: UseCasePlaybook[] = [
  {
    slug: 'funding-outreach',
    title: 'Funding outreach',
    subtitle: 'Reach the account while budgets and initiatives are being set.',
    promise: 'Turn a fresh funding signal into a clear “why now” message and a small next step.',
    whenWorksBest: [
      'Within the first few weeks of {{trigger_event}}, before priorities and owners harden.',
      'When you sell into execution: enablement, prioritization, reporting, workflow standardization.',
      'When you can offer a concrete artifact (checklist, pilot plan, first-week workflow) instead of a generic demo.',
    ],
    timingSignals: [
      'Recent {{trigger_event}} announcement (any stage).',
      'Hiring spike in RevOps, Enablement, SDR leadership, or GTM operations.',
      'New leadership hire tied to execution (CRO, VP RevOps, Head of Growth).',
      'Language about segment/region expansion or “enterprise push.”',
      'Mentions of standardizing process, tooling, reporting, or forecasting.',
      'Partnership/integration announcements alongside the funding news.',
      'Job descriptions that hint at evaluation or process rebuild.',
      'A clear internal owner emerges (or you can route to {{alt_owner}}).',
    ],
    angles: [
      { title: 'Execution gap', detail: '“Congrats on {{trigger_event}} — what execution bottleneck are you fixing first?”' },
      { title: 'Prioritization', detail: '“How are reps deciding who’s worth contacting today vs a backlog?”' },
      { title: 'Messaging consistency', detail: '“During growth phases, templates drift—who owns the standard?”' },
      { title: 'Enablement ramp', detail: 'Tie new headcount and ramp time to a simple sequence + token system.' },
      { title: 'RevOps build', detail: 'If they’re hiring ops roles, ask what system/process is being standardized next.' },
      { title: 'Coverage + cycles', detail: 'Anchor on {{metric}} and a first-week workflow, not feature comparisons.' },
      { title: 'Owner routing', detail: 'Make it easy to route: “Is this you or {{alt_owner}}?”' },
      { title: 'Checklist-first', detail: 'Lead with a one-page checklist. If they want, then talk.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'funding-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value, no guilt)', templateSlug: 'funding-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'funding-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'funding-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'funding-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'funding-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'funding-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Makes sense. When a vendor is in place, the gap is usually prioritization + consistency. If you share what you’re using for {{workflow}}, I’ll send a neutral checklist you can use to validate rollout + reporting.',
      },
      {
        objection: 'No priority right now',
        response:
          'Totally fair. The only reason I reached out is {{trigger_event}} often creates a short execution window. If it becomes priority later, I can circle back—what’s a realistic {{timeframe}} to re-check?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. Would a one-page checklist + a first-week workflow be more useful than a deck? If yes, I’ll send both and you can forward internally.',
      },
      {
        objection: 'Not my area',
        response:
          'No worries. Who owns {{initiative}} execution at {{company}}—you or {{alt_owner}}? If you point me to the right owner, I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Understood. If budget is tight, the goal is to avoid wasted cycles. I can send a checklist you can use to pressure-test rollout risk and expected impact on {{metric}} before you spend time.',
      },
      {
        objection: 'Timing',
        response:
          'All good. If you tell me the likely decision window ({{timeframe}}), I’ll set a reminder and only follow up then. Want me to send the checklist now so you have it when timing is right?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (tight, safe)',
        example:
          'Congrats on {{trigger_event}} at {{company}} — are you prioritizing {{initiative}} in the next {{timeframe}}? If yes, I can share a one-page checklist for turning timing signals into a daily shortlist + a send-ready draft tied to {{metric}}.',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: after {{trigger_event}}, who owns {{initiative}} execution at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist + examples and stop there.',
      },
    ],
    related: [
      { href: '/templates', label: 'Template library' },
      { href: '/compare', label: 'Buyer guides' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    slug: 'hiring-spike',
    title: 'Hiring spike outreach',
    subtitle: 'Catch the build phase while the workflow is being standardized.',
    promise: 'Turn hiring signals into outreach that’s specific, truthful, and easy to route.',
    whenWorksBest: [
      'When hiring indicates a build phase (new motion, new segment, new process).',
      'When messaging consistency matters (new reps, enablement changes, new managers).',
      'When you can tie your ask to one initiative ({{initiative}}) and one metric ({{metric}}).',
    ],
    timingSignals: [
      'Hiring surge in {{function}} or a specific role like {{role}}.',
      'Enablement or RevOps roles added to “scale the team.”',
      'New frontline leadership (manager/director) hired.',
      'Hiring language that implies a new segment or region.',
      'Job descriptions referencing tooling, reporting, routing, or process change.',
      'Multiple roles that suggest volume is increasing (SDR/AE growth).',
      'Team is building a new workflow (onboarding, enablement, scoring, routing).',
    ],
    angles: [
      { title: 'Ramp time', detail: 'Hiring spikes create a ramp problem. Offer a sequence pack + token system.' },
      { title: 'Consistency', detail: 'Prevent template drift as headcount grows—standardize “why now” and CTA.' },
      { title: 'Prioritization', detail: 'New reps need a daily shortlist, not a backlog.' },
      { title: 'Owner routing', detail: 'Make it easy to route: “is this you or {{alt_owner}}?”' },
      { title: 'Enablement workflow', detail: 'Offer a one-page enablement checklist: signals → shortlist → drafts.' },
      { title: 'Metric-driven', detail: 'Anchor on {{metric}} so it’s about outcomes, not tooling.' },
      { title: 'Role-specific', detail: 'Reference {{role}} safely—no assumptions beyond “build phase.”' },
      { title: 'Quick artifact', detail: 'Lead with a checklist. If it helps, then talk.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'hiring-spike-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value)', templateSlug: 'hiring-spike-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'hiring-spike-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'hiring-spike-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'hiring-spike-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'hiring-spike-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'hiring-spike-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Makes sense. During hiring spikes, the gap is usually consistency and prioritization. If you tell me what you use for {{workflow}}, I’ll send a checklist to validate rollout + reporting as the team scales.',
      },
      {
        objection: 'No priority right now',
        response:
          'Understood. Hiring is just a timing signal. If the build phase starts later, I can circle back—what’s a realistic {{timeframe}}?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. Would a one-page ramp checklist + a tokenized sequence pack be useful? If yes, I’ll send those instead of a generic deck.',
      },
      {
        objection: 'Not my area',
        response:
          'No problem. Who owns enablement/templates for {{initiative}} at {{company}}—you or {{alt_owner}}? I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Totally fair. The checklist is useful even if you don’t buy anything—it helps protect {{metric}} during scale by standardizing the workflow.',
      },
      {
        objection: 'Timing',
        response:
          'All good. Want me to send the ramp checklist now so it’s ready, and I’ll only follow up at {{timeframe}}?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (role + initiative)',
        example:
          'Saw the hiring push in {{function}} at {{company}} (roles like {{role}}). Is the push tied to {{initiative}} in the next {{timeframe}}? If yes, I can share a one-page ramp checklist and sequence pack tied to {{metric}}.',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: who owns enablement/templates for {{initiative}} at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist and examples and stop there.',
      },
    ],
    related: [
      { href: '/templates', label: 'Template library' },
      { href: '/compare', label: 'Buyer guides' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    slug: 'product-launch-timing',
    title: 'Product launch timing',
    subtitle: 'Use launch windows to earn a fast conversation without inventing facts.',
    promise: 'Keep the “why now” anchored to the launch and a concrete next step.',
    whenWorksBest: [
      'Right after a launch when teams are fixing friction and standardizing messaging.',
      'When your offer maps to post-launch execution (enablement, routing, reporting, adoption).',
      'When you can ask one crisp question and route to the real owner if needed.',
    ],
    timingSignals: [
      'New product/feature launch or GA announcement.',
      'Enablement changes (new messaging, new onboarding, new objections).',
      'Hiring for roles that scale execution.',
      'New integrations/partnerships tied to the launch.',
      'Language about “rollout,” “adoption,” or “enterprise readiness.”',
      'Any shift that forces re-prioritization of {{initiative}}.',
    ],
    angles: [
      { title: 'Post-launch friction', detail: 'Ask which bottleneck is being fixed first and offer a checklist.' },
      { title: 'Messaging drift', detail: 'Launch creates drift—standardize a sequence pack with tokens.' },
      { title: 'Prioritization', detail: 'Post-launch = backlog. Offer a daily shortlist workflow.' },
      { title: 'Owner routing', detail: 'Route to the enablement/RevOps owner quickly.' },
      { title: 'Metric-driven', detail: 'Tie the workflow to {{metric}} for week-1 improvements.' },
      { title: 'First-week plan', detail: 'Offer a one-week plan instead of a generic “demo.”' },
      { title: 'Safe why-now', detail: 'Reference {{trigger_event}} (launch) without claiming outcomes or news.' },
      { title: 'Checklist-first', detail: 'Send the checklist. If they want, talk.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'product-launch-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value)', templateSlug: 'product-launch-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'product-launch-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'product-launch-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'product-launch-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'product-launch-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'product-launch-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Makes sense. Post-launch, the gap is usually execution: prioritization and messaging. If you share what you use for {{workflow}}, I’ll send a checklist you can use to pressure-test rollout + reporting.',
      },
      {
        objection: 'No priority right now',
        response:
          'Totally fair. Launch windows just create timing. If the push happens later, I can circle back—what’s a realistic {{timeframe}}?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. Would a one-page post-launch outreach checklist + sequence pack be useful? If yes, I’ll send that instead of a generic deck.',
      },
      {
        objection: 'Not my area',
        response:
          'No worries. Who owns outbound enablement for {{initiative}} at {{company}}—you or {{alt_owner}}? I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Understood. The checklist is still useful to keep week-1 execution tight and protect {{metric}}—even if you don’t buy anything.',
      },
      {
        objection: 'Timing',
        response:
          'All good. Want the checklist now so it’s ready, and I’ll only follow up at {{timeframe}}?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (launch + initiative)',
        example:
          'Congrats on the launch at {{company}} — is the priority in the next {{timeframe}} {{initiative}} or {{alt_initiative}}? If it’s {{initiative}}, I can share a one-page checklist and sequence pack tied to {{metric}}.',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: post-launch, who owns outbound enablement for {{initiative}} at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist and stop there.',
      },
    ],
    related: [
      { href: '/templates', label: 'Template library' },
      { href: '/compare', label: 'Buyer guides' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    slug: 'partnership-announcement',
    title: 'Partnership announcements',
    subtitle: 'Turn the announcement into a concrete workflow question.',
    promise: 'Use partnerships as a “handoff” wedge: ownership, reporting, and enablement.',
    whenWorksBest: [
      'When a partnership implies a workflow change (handoffs, routing, reporting).',
      'When the buyer needs clarity on ownership and messaging standards.',
      'When you can ask a concrete question tied to {{handoff}} and stop there.',
    ],
    timingSignals: [
      '{{partner}} announcement paired with a rollout stage (pilot/GA).',
      'New integrations or processes implied between {{system_a}} and {{system_b}}.',
      'Enablement or RevOps roles that support rollout.',
      'Talk of new workflows, routing, or reporting.',
      'A clear internal owner exists (or you can route to {{alt_owner}}).',
      'Timeline pressure from launch/GA milestones.',
    ],
    angles: [
      { title: 'Handoff ownership', detail: 'Ask who owns {{handoff}} and how handoffs are tracked.' },
      { title: 'Reporting', detail: 'What metric defines success ({{metric}}) and where it is reported.' },
      { title: 'Enablement', detail: 'How reps explain “why now” without over-claiming.' },
      { title: 'Stage clarity', detail: 'Pilot vs GA changes expectations; ask directly.' },
      { title: 'Routing', detail: 'Who gets alerted when handoffs happen, and what happens next.' },
      { title: 'Consistency', detail: 'Prevent template drift during rollout; offer a sequence pack.' },
      { title: 'Owner routing', detail: 'Make it easy to route: “is this you or {{alt_owner}}?”' },
      { title: 'Checklist-first', detail: 'Send a rollout checklist; talk only if they want.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'partnership-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value)', templateSlug: 'partnership-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'partnership-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'partnership-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'partnership-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'partnership-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'partnership-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Totally fair. Rollouts still fail on ownership and reporting. If you tell me what you use for {{workflow}}, I’ll send a rollout checklist for {{handoff}} and how to keep messaging consistent.',
      },
      {
        objection: 'No priority right now',
        response:
          'Understood. Partnerships can be long-tail. If rollout timing changes, I can circle back—what’s a realistic {{timeframe}}?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. Would a short rollout checklist + 2 copy examples tied to {{handoff}} be useful? If yes, I’ll send that instead of a generic deck.',
      },
      {
        objection: 'Not my area',
        response:
          'No worries. Who owns enablement/templates for the rollout at {{company}}—you or {{alt_owner}}? I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Understood. The checklist helps you avoid rollout drift and protect {{metric}} even if you don’t buy anything.',
      },
      {
        objection: 'Timing',
        response:
          'All good. Want the checklist now so it’s ready, and I’ll only follow up at {{timeframe}}?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (handoff)',
        example:
          'Congrats on {{partner}} — for {{company}}, who owns {{handoff}} between {{system_a}} and {{system_b}}? If it’s active in the next {{timeframe}}, I can share a rollout checklist and copy examples tied to {{metric}}.',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: who owns enablement/templates for the {{partner}} rollout at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist and stop there.',
      },
    ],
    related: [
      { href: '/templates', label: 'Template library' },
      { href: '/compare', label: 'Buyer guides' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    slug: 'competitive-displacement',
    title: 'Competitive displacement',
    subtitle: 'Keep it neutral: success criteria, rollout risk, and reporting.',
    promise: 'Earn the conversation by helping the buyer avoid pilot drift.',
    whenWorksBest: [
      'When the buyer is in research, shortlist, or pilot for {{workflow}}.',
      'When you can offer a neutral evaluation checklist (not competitor trash talk).',
      'When you can route to the evaluation owner and keep the next step small.',
    ],
    timingSignals: [
      'Buyer mentions evaluating alternatives to {{vendor}}.',
      'Signals of a shortlist or pilot starting.',
      'Stakeholder changes (new owner, new ops/enablement hire).',
      'Reporting requirements becoming more visible.',
      'Enablement refresh or messaging changes.',
      'A clear owner exists (or you can route to {{alt_owner}}).',
    ],
    angles: [
      { title: 'Neutral checklist', detail: 'Lead with success criteria + rollout + reporting, not “features.”' },
      { title: 'Pilot drift', detail: 'Prevent pilots from becoming endless by defining decision points.' },
      { title: 'Rollout risk', detail: 'Adoption and enablement are usually the failure modes.' },
      { title: 'Reporting', detail: 'What breaks over time matters as much as day-1 features.' },
      { title: 'Owner routing', detail: 'Ask who owns evaluation and stop.' },
      { title: 'Week-1 plan', detail: 'Offer a pilot plan with what to test first.' },
      { title: 'Metric-driven', detail: 'Tie to {{metric}} (cycle time, coverage, meetings) without claiming outcomes.' },
      { title: 'Checklist-first', detail: 'Send the checklist. Talk only if they want.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'competitive-displacement-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value)', templateSlug: 'competitive-displacement-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'competitive-displacement-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'competitive-displacement-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'competitive-displacement-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'competitive-displacement-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'competitive-displacement-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Makes sense. The checklist is still useful—it’s neutral and focuses on success, rollout, and reporting. Want it for {{workflow}} so you can pressure-test the decision?',
      },
      {
        objection: 'No priority right now',
        response:
          'Understood. If evaluation becomes active later, I can circle back—what’s a realistic {{timeframe}} to re-check?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. I’ll send a one-page evaluation checklist + a simple pilot plan. If it’s useful, we can talk; if not, you still have the artifact.',
      },
      {
        objection: 'Not my area',
        response:
          'No worries. Who owns evaluation for {{workflow}} at {{company}}—you or {{alt_owner}}? I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Totally fair. The checklist is designed to avoid wasted cycles and protect {{metric}} even if you don’t buy anything.',
      },
      {
        objection: 'Timing',
        response:
          'All good. Want the checklist now so it’s ready, and I’ll only follow up at {{timeframe}}?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (neutral)',
        example:
          'If you’re evaluating alternatives to {{vendor}} for {{workflow}} at {{company}}, I can share a one-page checklist (success criteria + rollout risk + reporting) to keep the pilot from drifting. Want it?',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: who owns evaluation for {{workflow}} at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist and stop there.',
      },
    ],
    related: [
      { href: '/compare', label: 'Buyer guides' },
      { href: '/templates', label: 'Template library' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    slug: 'expansion-signals',
    title: 'Expansion signals',
    subtitle: 'Use expansion to talk about execution consistency before drift sets in.',
    promise: 'Standardize the workflow: signals → shortlist → sequence pack.',
    whenWorksBest: [
      'When expansion into {{region_or_segment}} creates segmentation and routing changes.',
      'When a consistent workflow matters more than “more touches.”',
      'When you can tie the ask to one initiative and one metric.',
    ],
    timingSignals: [
      'Expansion into {{region_or_segment}} (new segment or new region).',
      'New roles added to support scale (enablement, ops, leadership).',
      'Messaging changes or new enablement initiatives.',
      'Routing/reporting changes as segments split.',
      'A clear owner exists (or you can route to {{alt_owner}}).',
      'A defined decision window ({{timeframe}}).',
    ],
    angles: [
      { title: 'Execution drift', detail: 'Expansion causes drift—templates, routing, and prioritization need a standard.' },
      { title: 'Segmentation', detail: 'New segments require new “why now” messages that remain truthful.' },
      { title: 'Prioritization', detail: 'Prevent backlog sprawl with a daily shortlist tied to signals.' },
      { title: 'Owner routing', detail: 'Route to the owner of {{initiative}}.' },
      { title: 'Enablement', detail: 'Sequence pack + tokens keep messaging consistent across reps.' },
      { title: 'Reporting', detail: 'Tie workflow to {{metric}} with visible reasons.' },
      { title: 'First-week plan', detail: 'Offer a week-1 plan: ICP, watchlist, cadence, and drafts.' },
      { title: 'Checklist-first', detail: 'Send the expansion checklist; talk only if they want.' },
    ],
    sequencePack: [
      { day: 'Day 0', label: 'Email — short', templateSlug: 'expansion-email-1-short' },
      { day: 'Day 2', label: 'Email — follow-up (value)', templateSlug: 'expansion-email-followup-1' },
      { day: 'Day 5', label: 'Email — follow-up (tight ask)', templateSlug: 'expansion-email-followup-2' },
      { day: 'Day 7', label: 'Email — breakup', templateSlug: 'expansion-email-3-breakup' },
      { day: 'Day 1', label: 'LinkedIn DM — ultra short', templateSlug: 'expansion-linkedin-1-ultra-short' },
      { day: 'Day 4', label: 'LinkedIn DM — value + question', templateSlug: 'expansion-linkedin-2-value' },
      { day: 'Any', label: 'Call opener', templateSlug: 'expansion-call-1-opener' },
    ],
    objections: [
      {
        objection: 'Already have a vendor',
        response:
          'Makes sense. Expansion still creates execution drift. If you tell me what you use for {{workflow}}, I’ll send an expansion checklist you can use to standardize routing and protect {{metric}}.',
      },
      {
        objection: 'No priority right now',
        response:
          'Understood. Expansion timing varies. If execution becomes priority later, I can circle back—what’s a realistic {{timeframe}}?',
      },
      {
        objection: 'Send info',
        response:
          'Happy to. I’ll send a one-page expansion execution checklist + sequence pack. If it’s useful, we can talk; if not, you still have the artifact.',
      },
      {
        objection: 'Not my area',
        response:
          'No worries. Who owns execution for {{initiative}} at {{company}}—you or {{alt_owner}}? I’ll send the checklist and stop there.',
      },
      {
        objection: 'Budget',
        response:
          'Totally fair. The checklist is useful even without buying—helps avoid wasted cycles and protects {{metric}} during scale.',
      },
      {
        objection: 'Timing',
        response:
          'All good. Want the checklist now so it’s ready, and I’ll only follow up at {{timeframe}}?',
      },
    ],
    personalizationExamples: [
      {
        label: 'Example 1 (expansion + initiative)',
        example:
          'Congrats on expansion into {{region_or_segment}} — is the priority in the next {{timeframe}} {{initiative}} or {{alt_initiative}} for {{company}}? If it’s {{initiative}}, I can share a one-page checklist + sequence pack tied to {{metric}}.',
      },
      {
        label: 'Example 2 (owner routing)',
        example:
          'Quick routing question: during expansion, who owns execution for {{initiative}} at {{company}}—you or {{alt_owner}}? If you point me to the owner, I’ll send the checklist and stop there.',
      },
    ],
    related: [
      { href: '/templates', label: 'Template library' },
      { href: '/compare', label: 'Buyer guides' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
]

export function getUseCasePlaybook(slug: UseCasePlaybook['slug']): UseCasePlaybook {
  const found = USE_CASE_PLAYBOOKS.find((p) => p.slug === slug)
  if (!found) {
    // Exhaustive by construction. If this throws, someone added a new page without updating the registry.
    throw new Error(`Unknown use-case playbook: ${slug}`)
  }
  return found
}

