import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const SAMPLE_SEED_VERSION = 1 as const

type LeadInsertRow = {
  id: string
  user_id: string
  company_url: string
  company_domain: string
  company_name: string
  ai_personalized_pitch: string
  is_sample: boolean
}

type TriggerEventInsertRow = {
  id: string
  user_id: string
  lead_id: string
  event_type: string
  payload: Record<string, unknown> | null
  company_name: string
  company_domain: string
  company_url: string
  headline: string
  event_description: string
  source_url: string
  detected_at: string
  is_sample: boolean
}

type PitchInsertRow = {
  id: string
  user_id: string
  lead_id: string
  content: string
  model: string | null
  tokens: number | null
  is_sample: boolean
}

type ReportInsertRow = {
  id: string
  user_id: string
  status: 'complete'
  company_name: string
  company_domain: string | null
  input_url: string | null
  title: string
  report_markdown: string
  report_json: Record<string, unknown> | null
  meta: Record<string, unknown>
  report_kind: 'competitive'
  report_version: number
  sources_used: unknown[]
  sources_fetched_at: string | null
  is_sample: boolean
}

function nowIso(): string {
  return new Date().toISOString()
}

function sampleCompanies(): Array<{ name: string; domain: string }> {
  // Intentionally fictitious, obviously demo-labeled, and not pointing at real companies.
  return [
    { name: 'SampleCo Robotics', domain: 'sampleco-robotics.example.com' },
    { name: 'SampleCo FinTech', domain: 'sampleco-fintech.example.com' },
    { name: 'SampleCo Health', domain: 'sampleco-health.example.com' },
    { name: 'SampleCo Cloud', domain: 'sampleco-cloud.example.com' },
    { name: 'SampleCo Retail', domain: 'sampleco-retail.example.com' },
  ]
}

function samplePitch(companyName: string): string {
  return [
    `Sample pitch preview — ${companyName}`,
    '',
    'This is demo data (sample mode).',
    '',
    'Why now:',
    '- A recent trigger suggests active evaluation (sample signal).',
    '- Timing is strong for a short workflow review.',
    '',
    'First-touch draft:',
    '“Quick question — are you prioritizing pipeline creation, conversion, or expansion this quarter?”',
  ].join('\n')
}

function sampleReportMarkdown(companyName: string, domain: string): string {
  return [
    `# Competitive Intelligence Report: ${companyName} (Sample)`,
    '',
    '## Sources & Freshness',
    `Last refreshed: ${nowIso()}`,
    '',
    '### first_party_fallback',
    `- https://${domain}/ (sample)`,
    '',
    '## Executive summary',
    'This is a sample report generated in proof mode. It demonstrates the workflow and UI without making factual claims about a real company.',
    '',
    '## Market context & positioning',
    '- Sample: validate category language on the homepage and pricing page.',
    '',
    '## Competitor map',
    '- Sample: list 3 alternatives mentioned in docs/integrations.',
    '',
    '## Differentiators & vulnerabilities',
    '- Sample: pick one measurable outcome and one implementation risk to validate.',
    '',
    '## Buying triggers & “why now” angles',
    '- Sample: tie a recent signal to a narrow pilot ask.',
    '',
    '## Recommended outreach angles (5)',
    '- Sample angle 1 (hypothesis, verify).',
    '- Sample angle 2 (hypothesis, verify).',
    '- Sample angle 3 (hypothesis, verify).',
    '- Sample angle 4 (hypothesis, verify).',
    '- Sample angle 5 (hypothesis, verify).',
    '',
    '## Objection handling (5)',
    '- Sample objection 1 → response.',
    '- Sample objection 2 → response.',
    '- Sample objection 3 → response.',
    '- Sample objection 4 → response.',
    '- Sample objection 5 → response.',
    '',
    '## Suggested 7-touch sequence (email + LinkedIn + call openers)',
    '- Email 1: one-sentence hypothesis + question.',
    '- LinkedIn DM 1: short note + confirm owner.',
    '- Call 1: permission-based opener.',
    '- Email 2: checklist + narrow CTA.',
    '- LinkedIn DM 2: one timing cue + question.',
    '- Call 2: propose 7-day pilot scope.',
    '- Email 3: breakup + “close the loop?”.',
    '',
    '## Next steps checklist',
    '- Sample: pick a goal and run the workflow end-to-end.',
    '',
    '## Sources (links)',
    `- https://${domain}/ (sample)`,
    '',
  ].join('\n')
}

export async function purgeSampleData(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<void> {
  const client =
    (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
      ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
      : args.supabase

  // Delete child records first to respect foreign keys.
  await client.from('trigger_events').delete().eq('user_id', args.userId).eq('is_sample', true)
  await client.from('pitches').delete().eq('user_id', args.userId).eq('is_sample', true)
  await client.from('user_reports').delete().eq('user_id', args.userId).eq('is_sample', true)
  await client.from('leads').delete().eq('user_id', args.userId).eq('is_sample', true)
}

export async function seedSampleModeData(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<{ ok: true; seededCounts: { leads: number; triggers: number; pitches: number; reports: number } } | { ok: false; reason: string }> {
  const client =
    (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
      ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
      : args.supabase

  const companies = sampleCompanies()
  const leads: LeadInsertRow[] = companies.map((c) => ({
    id: randomUUID(),
    user_id: args.userId,
    company_url: `https://${c.domain}`,
    company_domain: c.domain,
    company_name: `${c.name} (Sample)`,
    ai_personalized_pitch: samplePitch(c.name),
    is_sample: true,
  }))

  const leadIdByDomain = new Map<string, string>(leads.map((l) => [l.company_domain, l.id]))

  const triggers: TriggerEventInsertRow[] = companies.flatMap((c, idx) => {
    const leadId = leadIdByDomain.get(c.domain)
    if (!leadId) return []
    const detectedAt = new Date(Date.now() - idx * 6 * 60 * 60 * 1000).toISOString()
    return [
      {
        id: randomUUID(),
        user_id: args.userId,
        lead_id: leadId,
        event_type: 'product_launch',
        payload: { demo: true, kind: 'product_launch' },
        company_name: `${c.name} (Sample)`,
        company_domain: c.domain,
        company_url: `https://${c.domain}`,
        headline: `Demo event: ${c.name} announces a product update`,
        event_description: 'Sample signal for proof mode. Not a real event.',
        source_url: `https://${c.domain}/blog/sample-update`,
        detected_at: detectedAt,
        is_sample: true,
      },
      {
        id: randomUUID(),
        user_id: args.userId,
        lead_id: leadId,
        event_type: 'new_hires',
        payload: { demo: true, kind: 'new_hires' },
        company_name: `${c.name} (Sample)`,
        company_domain: c.domain,
        company_url: `https://${c.domain}`,
        headline: `Demo event: ${c.name} shows a hiring spike`,
        event_description: 'Sample signal for proof mode. Not a real event.',
        source_url: `https://${c.domain}/careers`,
        detected_at: new Date(Date.parse(detectedAt) - 2 * 60 * 60 * 1000).toISOString(),
        is_sample: true,
      },
    ]
  })

  const pitches: PitchInsertRow[] = leads.slice(0, 2).map((l) => ({
    id: randomUUID(),
    user_id: args.userId,
    lead_id: l.id,
    content: l.ai_personalized_pitch,
    model: null,
    tokens: null,
    is_sample: true,
  }))

  const reports: ReportInsertRow[] = leads.slice(0, 1).map((l) => ({
    id: randomUUID(),
    user_id: args.userId,
    status: 'complete',
    company_name: l.company_name,
    company_domain: l.company_domain,
    input_url: l.company_url,
    title: `Competitive report: ${l.company_name}`,
    report_markdown: sampleReportMarkdown(l.company_name, l.company_domain),
    report_json: null,
    meta: { source: 'sample_mode', seedVersion: SAMPLE_SEED_VERSION, generatedAt: nowIso() },
    report_kind: 'competitive',
    report_version: 1,
    sources_used: [],
    sources_fetched_at: null,
    is_sample: true,
  }))

  // Insert in FK-safe order.
  const { error: leadErr } = await client.from('leads').insert(leads as unknown as never[])
  if (leadErr) return { ok: false, reason: 'insert_leads_failed' }

  const { error: triggerErr } = await client.from('trigger_events').insert(triggers as unknown as never[])
  if (triggerErr) return { ok: false, reason: 'insert_trigger_events_failed' }

  const { error: pitchErr } = await client.from('pitches').insert(pitches as unknown as never[])
  if (pitchErr) return { ok: false, reason: 'insert_pitches_failed' }

  const { error: reportErr } = await client.from('user_reports').insert(reports as unknown as never[])
  if (reportErr) return { ok: false, reason: 'insert_reports_failed' }

  // Mark settings (best-effort; older schema may not include columns).
  try {
    await client
      .from('user_settings')
      .upsert(
        {
          user_id: args.userId,
          sample_mode_enabled: true,
          sample_seeded_at: nowIso(),
          sample_seed_version: SAMPLE_SEED_VERSION,
          updated_at: nowIso(),
        } as unknown as never,
        { onConflict: 'user_id' }
      )
  } catch {
    // best-effort only (schema drift tolerant)
  }

  return { ok: true, seededCounts: { leads: leads.length, triggers: triggers.length, pitches: pitches.length, reports: reports.length } }
}

