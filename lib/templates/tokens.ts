export type TemplateTokenDef = {
  token: `{{${string}}}`
  meaning: string
  how: string
}

export const TEMPLATE_TOKEN_GLOSSARY: TemplateTokenDef[] = [
  { token: '{{company}}', meaning: 'Target account', how: 'Company name (or domain if you prefer).' },
  { token: '{{name}}', meaning: 'Contact first name', how: 'First name only.' },
  { token: '{{role}}', meaning: 'Role / title', how: 'Use the person’s role if known (or the role you’re targeting).' },
  { token: '{{trigger_event}}', meaning: 'Why now trigger', how: 'Funding, hiring spike, partnership, product launch, displacement, expansion.' },
  { token: '{{initiative}}', meaning: 'Likely priority', how: 'One initiative tied to the trigger (pipeline, enablement, reporting, security, expansion).' },
  { token: '{{alt_initiative}}', meaning: 'Alternative priority', how: 'A credible alternative so the question is easy to answer.' },
  { token: '{{alt_owner}}', meaning: 'Alternate owner', how: 'Likely owner: RevOps, Enablement, SDR leader, VP Sales, Partnerships, Product.' },
  { token: '{{timeframe}}', meaning: 'Decision window', how: '“30 days”, “this quarter”, “next 60 days”.' },
  { token: '{{metric}}', meaning: 'Target metric', how: 'One metric that matters (reply rate, meetings, cycle time, ramp time, pipeline coverage).' },
  { token: '{{function}}', meaning: 'Function', how: 'The function (GTM, RevOps, Security, Product, Partnerships).' },
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

