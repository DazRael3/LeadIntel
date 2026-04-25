'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'

type ResponseStatus = 'not sent' | 'sent' | 'replied' | 'interested' | 'booked' | 'closed' | 'not interested'
type TemplateKey = 'initial' | 'followup1' | 'followup2'
type ReplyType = 'interested' | 'objection' | 'not interested' | 'asked for details' | 'booked call' | 'no fit'
type ProofMetric = 'replies' | 'calls booked' | 'leads generated' | 'time saved' | 'paid conversion'
type PermissionStatus = 'private note' | 'anonymous proof' | 'approved public testimonial'

type ReplyLearningEntry = {
  id: string
  leadId: string | null
  companyName: string
  replyType: ReplyType
  replyText: string
  createdAt: string
}

type ProofEntry = {
  id: string
  customerName: string
  niche: string
  problem: string
  result: string
  metric: ProofMetric
  quote: string
  permissionStatus: PermissionStatus
  createdAt: string
}

type RevenueRoadmapInputs = {
  messagesSent: number
  replies: number
  interestedProspects: number
  callsBooked: number
  trialsStarted: number
  paidUsers: number
  manualMrr: number
}

type LeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  prospect_email: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

type TriggerRow = {
  lead_id: string | null
  event_type: string | null
  headline: string | null
  event_description: string | null
  detected_at: string | null
  created_at: string | null
}

type OutboundLead = {
  id: string
  companyName: string
  companyDomain: string | null
  prospectEmail: string | null
  fitScore: number
  industry: string
  role: string
  hasHiringSignal: boolean
  whyNow: string
  generatedMessage: string
  primaryTrigger: string
  whyThisLead: string[]
  createdAt: string
}

const STATUS_STORAGE_KEY = 'leadintel-outbound-response-status-v2'
const MESSAGE_STORAGE_KEY = 'leadintel-outbound-message-drafts-v2'
const REPLY_LEARNING_STORAGE_KEY = 'leadintel-outbound-reply-learning-v1'
const PROOF_BUILDER_STORAGE_KEY = 'leadintel-outbound-proof-builder-v1'
const REVENUE_ROADMAP_STORAGE_KEY = 'leadintel-outbound-revenue-roadmap-v1'
const DAILY_CHECKLIST_STORAGE_KEY = 'leadintel-outbound-daily-checklist-v1'
const DAILY_SEND_GOAL = 20
const PLAN_PRICE = 79
const TEMPLATE_OPTIONS: ReadonlyArray<{ key: TemplateKey; label: string }> = [
  { key: 'initial', label: 'Initial outreach' },
  { key: 'followup1', label: 'Follow-up #1' },
  { key: 'followup2', label: 'Follow-up #2' },
]
const RESPONSE_STATUS_OPTIONS: ReadonlyArray<ResponseStatus> = [
  'not sent',
  'sent',
  'replied',
  'interested',
  'booked',
  'closed',
  'not interested',
]
const SENT_LIKE_STATUSES = new Set<ResponseStatus>(['sent', 'replied', 'interested', 'booked', 'closed', 'not interested'])
const REPLY_LIKE_STATUSES = new Set<ResponseStatus>(['replied', 'interested', 'booked', 'closed'])
const REPLY_TYPE_OPTIONS: ReadonlyArray<ReplyType> = [
  'interested',
  'objection',
  'not interested',
  'asked for details',
  'booked call',
  'no fit',
]
const PROOF_METRIC_OPTIONS: ReadonlyArray<ProofMetric> = [
  'replies',
  'calls booked',
  'leads generated',
  'time saved',
  'paid conversion',
]
const PERMISSION_OPTIONS: ReadonlyArray<PermissionStatus> = [
  'private note',
  'anonymous proof',
  'approved public testimonial',
]
const DAILY_CHECKLIST_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'generate_select_20', label: 'Generate/select 20 leads' },
  { id: 'send_20', label: 'Send 20 messages' },
  { id: 'follow_up_yesterday', label: "Follow up yesterday's prospects" },
  { id: 'log_replies', label: 'Log replies' },
  { id: 'improve_message', label: 'Improve best message' },
  { id: 'ask_live_demo', label: 'Ask interested prospect for a live demo' },
  { id: 'record_proof', label: 'Record proof/result' },
]
const REPLY_RESPONSE_TEMPLATE_LIBRARY: ReadonlyArray<{ id: string; label: string; text: string }> = [
  {
    id: 'interested',
    label: 'Interested',
    text: 'Great - I can generate 5 leads for your market so you can judge the quality before committing. What niche should I run?',
  },
  {
    id: 'asked_details',
    label: 'Asked for details',
    text: 'LeadIntel finds companies showing buying signals, scores them, and writes outreach you can send immediately. I can show you 5 examples for your market.',
  },
  {
    id: 'objection_too_busy',
    label: 'Objection: too busy',
    text: 'No problem - I can send a short sample list instead. If it looks useful, we can talk later.',
  },
  {
    id: 'objection_have_leads',
    label: 'Objection: already have leads',
    text: 'Makes sense. Most teams have lists; the gap is usually timing + outreach quality. I can show you leads with why-now signals.',
  },
  {
    id: 'not_interested',
    label: 'Not interested',
    text: "Totally fair - I'll close the loop. If pipeline quality becomes a focus later, happy to share a sample.",
  },
  {
    id: 'booked_call',
    label: 'Booked call',
    text: "Perfect - I'll prepare a short lead list for your target market before the call.",
  },
  {
    id: 'reengagement_email',
    label: 'Re-engagement email',
    text: 'Quick follow-up: I can send 5 high-intent leads for your market so you can judge fit in 2 minutes. Want me to run it?',
  },
  {
    id: 'reengagement_in_app',
    label: 'In-app reminder',
    text: "You're close to pipeline lift. Unlock full access to get 20+ daily leads and outreach ready to send.",
  },
  {
    id: 'reengagement_sms',
    label: 'SMS reminder',
    text: 'Want 5 ready-to-contact leads for your niche today? Reply and I’ll send a sample list.',
  },
]

function parseFitScore(draft: string | null): number {
  if (!draft) return 0
  const matched = draft.match(/^\[LeadIntel Fit (\d{1,3})\/100\]/)
  const score = matched ? Number.parseInt(matched[1], 10) : 0
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, score))
}

function parseField(draft: string | null, label: string): string {
  if (!draft) return 'Unknown'
  const regex = new RegExp(`^${label}:\\s*(.+)$`, 'im')
  const matched = draft.match(regex)
  const value = matched?.[1]?.trim()
  return value && value.length > 0 ? value : 'Unknown'
}

function parseWhyNow(draft: string | null): string {
  if (!draft) return 'Recent signals suggest strong timing.'
  const firstLine = draft.split('\n')[0] ?? ''
  const matched = firstLine.match(/^\[LeadIntel Fit \d{1,3}\/100\]\s*(.+)$/)
  if (matched?.[1]?.trim()) return matched[1].trim()
  return 'Recent signals suggest strong timing.'
}

function parseGeneratedMessage(draft: string | null, companyName: string): string {
  if (!draft) {
    return `Hi ${companyName} team,\n\nNoticed recent momentum and wanted to share a quick idea.\n\nGenerated by raelinfo.com`
  }
  const lines = draft
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('[LeadIntel Fit '))
  if (lines.length === 0) {
    return `Hi ${companyName} team,\n\nNoticed recent momentum and wanted to share a quick idea.\n\nGenerated by raelinfo.com`
  }
  return `${lines.join('\n')}\n\nGenerated by raelinfo.com`
}

function isHiringSignal(trigger: TriggerRow | null): boolean {
  if (!trigger) return false
  const haystack = `${trigger.event_type ?? ''} ${trigger.headline ?? ''} ${trigger.event_description ?? ''}`.toLowerCase()
  return haystack.includes('hiring') || haystack.includes('hire') || haystack.includes('new role')
}

function classifyTriggerSignal(trigger: TriggerRow): 'hiring signal' | 'expansion signal' | 'funding/growth signal' | null {
  const haystack = `${trigger.event_type ?? ''} ${trigger.headline ?? ''} ${trigger.event_description ?? ''}`.toLowerCase()
  if (haystack.includes('hiring') || haystack.includes('hire') || haystack.includes('new role') || haystack.includes('headcount')) {
    return 'hiring signal'
  }
  if (
    haystack.includes('expansion')
    || haystack.includes('new market')
    || haystack.includes('new region')
    || haystack.includes('office')
    || haystack.includes('launch')
    || haystack.includes('partnership')
  ) {
    return 'expansion signal'
  }
  if (
    haystack.includes('funding')
    || haystack.includes('raised')
    || haystack.includes('series ')
    || haystack.includes('growth')
    || haystack.includes('revenue')
    || haystack.includes('acquisition')
    || haystack.includes('investment')
  ) {
    return 'funding/growth signal'
  }
  return null
}

function summarizeTrigger(trigger: TriggerRow | null): string {
  if (!trigger) return 'showing fresh buying signals'
  const preferred = trigger.headline?.trim() || trigger.event_description?.trim() || trigger.event_type?.trim()
  if (!preferred) return 'showing fresh buying signals'
  return preferred.length > 120 ? `${preferred.slice(0, 117)}...` : preferred
}

function buildWhyThisLead(args: {
  triggerRows: TriggerRow[]
  role: string
  industry: string
  companyName: string
}): string[] {
  const categories = new Set<string>()
  for (const trigger of args.triggerRows) {
    const category = classifyTriggerSignal(trigger)
    if (category) categories.add(category)
  }
  return [
    categories.has('hiring signal')
      ? 'Hiring signal: team growth or role expansion is active.'
      : 'Hiring signal: no recent hiring trigger detected yet.',
    categories.has('expansion signal')
      ? 'Expansion signal: new market/product/partnership activity is visible.'
      : 'Expansion signal: no recent expansion trigger detected yet.',
    categories.has('funding/growth signal')
      ? 'Funding/growth signal: momentum and budget window may be open.'
      : 'Funding/growth signal: no recent funding/growth trigger detected yet.',
    `Role/company fit: ${args.role} in ${args.industry} at ${args.companyName}.`,
  ]
}

function buildTemplateMessage(lead: OutboundLead, templateKey: TemplateKey): string {
  const trigger = lead.primaryTrigger
  if (templateKey === 'initial') {
    return [
      `Hey - noticed ${lead.companyName} is ${trigger}.`,
      '',
      'Teams at this stage usually need more qualified pipeline without more manual research.',
      '',
      'I built LeadIntel to find high-intent leads and write outreach daily.',
      '',
      'Worth seeing 5 leads for your business?',
    ].join('\n')
  }
  if (templateKey === 'followup1') {
    return [
      `Quick follow-up - I can show you a short lead list for ${lead.companyName} so you can judge if it's useful.`,
      '',
      'Worth seeing 5 leads for your business?',
    ].join('\n')
  }
  return [
    'Should I close this out, or would seeing 5 fresh leads for your market be useful?',
    '',
    'Worth seeing 5 leads for your business?',
  ].join('\n')
}

function draftKey(leadId: string, templateKey: TemplateKey): string {
  return `${leadId}:${templateKey}`
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function checklistDateKey(date: string): string {
  return date
}

function buildReplyRecommendation(replyType: ReplyType): {
  recommendedNextResponse: string
  objectionHandlingAngle: string
  suggestedFollowUp: string
} {
  if (replyType === 'interested') {
    return {
      recommendedNextResponse:
        'Great - I can generate 5 leads for your market so you can judge the quality before committing. What niche should I run?',
      objectionHandlingAngle: 'Keep momentum and move directly into a concrete sample promise.',
      suggestedFollowUp: 'Send a sample lead list within 24 hours and ask for a 15-minute review call.',
    }
  }
  if (replyType === 'asked for details') {
    return {
      recommendedNextResponse:
        'LeadIntel finds companies showing buying signals, scores them, and writes outreach you can send immediately. I can show you 5 examples for your market.',
      objectionHandlingAngle: 'Clarify the workflow in one sentence, then offer proof instead of more explanation.',
      suggestedFollowUp: 'Share 3-5 sample leads with why-now context and one outreach message.',
    }
  }
  if (replyType === 'booked call') {
    return {
      recommendedNextResponse:
        "Perfect - I'll prepare a short lead list for your target market before the call.",
      objectionHandlingAngle: 'Increase call quality with prep and custom context.',
      suggestedFollowUp: 'Arrive with sample leads, one use-case message, and a clear pilot CTA.',
    }
  }
  if (replyType === 'objection') {
    return {
      recommendedNextResponse: 'No problem - I can send a short sample list instead. If it looks useful, we can talk later.',
      objectionHandlingAngle: 'Reduce commitment: offer a lightweight sample over a full meeting.',
      suggestedFollowUp: 'Reply with 3 specific leads and ask if one looks worth discussing.',
    }
  }
  if (replyType === 'not interested') {
    return {
      recommendedNextResponse:
        "Totally fair - I'll close the loop. If pipeline quality becomes a focus later, happy to share a sample.",
      objectionHandlingAngle: 'Exit politely while keeping an easy re-entry path.',
      suggestedFollowUp: 'Set a future reminder and check back only with a concise value update.',
    }
  }
  return {
    recommendedNextResponse:
      "Understood - if it's helpful, I can still share 5 example leads so you can quickly confirm whether there's a fit.",
    objectionHandlingAngle: 'Use low-friction proof to validate fit before asking for commitment.',
    suggestedFollowUp: 'Send a sample with one clear success criterion and close the loop if no response.',
  }
}

function buildReplyTemplate(replyType: ReplyType): string {
  if (replyType === 'interested') {
    return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'interested')?.text ?? ''
  }
  if (replyType === 'asked for details') {
    return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'asked_details')?.text ?? ''
  }
  if (replyType === 'objection') {
    return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'objection_too_busy')?.text ?? ''
  }
  if (replyType === 'not interested') {
    return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'not_interested')?.text ?? ''
  }
  if (replyType === 'booked call') {
    return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'booked_call')?.text ?? ''
  }
  return REPLY_RESPONSE_TEMPLATE_LIBRARY.find((item) => item.id === 'objection_have_leads')?.text ?? ''
}

function buildProofCopy(entry: ProofEntry): {
  shortProofSnippet: string
  landingTestimonial: string
  linkedInPostDraft: string
  caseStudyOutline: string
} {
  const subject = entry.permissionStatus === 'anonymous proof' ? `${entry.niche} team` : entry.customerName || `${entry.niche} customer`
  const metricLine = entry.result.trim().length > 0 ? entry.result.trim() : `Improved ${entry.metric} with LeadIntel.`
  const quote = entry.quote.trim().length > 0 ? entry.quote.trim() : 'LeadIntel helped us move faster from lead discovery to outreach.'
  const shortProofSnippet = `${subject}: ${metricLine}`
  const landingTestimonial = `"${quote}" - ${subject}`
  const linkedInPostDraft = [
    `Proof from this week: ${metricLine}`,
    '',
    `Context: ${entry.problem.trim() || 'Team needed better outbound timing and message quality.'}`,
    'LeadIntel helped us find high-intent leads and ship outreach faster.',
    '',
    'If you want, I can generate 5 sample leads for your niche.',
  ].join('\n')
  const caseStudyOutline = [
    `Customer/Niche: ${subject} (${entry.niche || 'N/A'})`,
    `Problem before LeadIntel: ${entry.problem || 'N/A'}`,
    `Result achieved: ${metricLine}`,
    `Metric focus: ${entry.metric}`,
    `Quote: ${quote}`,
    `Permission status: ${entry.permissionStatus}`,
  ].join('\n')
  return {
    shortProofSnippet,
    landingTestimonial,
    linkedInPostDraft,
    caseStudyOutline,
  }
}

function deriveConversionBottleneck(inputs: RevenueRoadmapInputs): string {
  if (inputs.messagesSent <= 0) return 'Bottleneck: top of funnel. Send the first 20 messages.'
  if (inputs.replies <= 0) return 'Bottleneck: reply rate. Improve opening line and targeting.'
  if (inputs.interestedProspects <= 0) return 'Bottleneck: qualification. Sharpen value framing after first reply.'
  if (inputs.callsBooked <= 0) return 'Bottleneck: call conversion. Offer a concrete 5-lead live demo.'
  if (inputs.trialsStarted <= 0) return 'Bottleneck: trial starts. Add stronger post-call next steps.'
  if (inputs.paidUsers <= 0) return 'Bottleneck: paid conversion. Strengthen close and proof after trial.'

  const replyRate = inputs.replies / inputs.messagesSent
  const interestRate = inputs.interestedProspects / Math.max(1, inputs.replies)
  const bookingRate = inputs.callsBooked / Math.max(1, inputs.interestedProspects)
  const trialRate = inputs.trialsStarted / Math.max(1, inputs.callsBooked)
  const closeRate = inputs.paidUsers / Math.max(1, inputs.trialsStarted)
  const pairs: Array<{ label: string; value: number }> = [
    { label: 'reply rate', value: replyRate },
    { label: 'interest rate', value: interestRate },
    { label: 'call booking rate', value: bookingRate },
    { label: 'trial start rate', value: trialRate },
    { label: 'close rate', value: closeRate },
  ]
  const min = pairs.reduce((lowest, current) => (current.value < lowest.value ? current : lowest), pairs[0])
  return `Bottleneck: ${min.label}. This is the weakest step in your current funnel.`
}

export function OutboundExecutionPanel() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [leads, setLeads] = useState<OutboundLead[]>([])
  const [industryFilter, setIndustryFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [hiringFilter, setHiringFilter] = useState<'all' | 'hiring'>('all')
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('initial')
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [responseStatuses, setResponseStatuses] = useState<Record<string, ResponseStatus>>({})
  const [copied, setCopied] = useState(false)
  const [replyLearningLog, setReplyLearningLog] = useState<ReplyLearningEntry[]>([])
  const [replyLearningForm, setReplyLearningForm] = useState<{ replyText: string; replyType: ReplyType }>({
    replyText: '',
    replyType: 'interested',
  })
  const [proofEntries, setProofEntries] = useState<ProofEntry[]>([])
  const [proofForm, setProofForm] = useState<{
    customerName: string
    niche: string
    problem: string
    result: string
    metric: ProofMetric
    quote: string
    permissionStatus: PermissionStatus
  }>({
    customerName: '',
    niche: '',
    problem: '',
    result: '',
    metric: 'leads generated',
    quote: '',
    permissionStatus: 'private note',
  })
  const [revenueRoadmap, setRevenueRoadmap] = useState<RevenueRoadmapInputs>({
    messagesSent: 0,
    replies: 0,
    interestedProspects: 0,
    callsBooked: 0,
    trialsStarted: 0,
    paidUsers: 0,
    manualMrr: 0,
  })
  const [dailyChecklistState, setDailyChecklistState] = useState<Record<string, string[]>>({})

  const loadOutboundLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLeads([])
        return
      }

      const { data: leadRowsRaw, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name, company_domain, company_url, prospect_email, ai_personalized_pitch, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (leadError) throw leadError
      const leadRows = (leadRowsRaw ?? []) as LeadRow[]
      const leadIds = leadRows.map((row) => row.id)

      let triggerRows: TriggerRow[] = []
      if (leadIds.length > 0) {
        const { data: triggerRowsRaw } = await supabase
          .from('trigger_events')
          .select('lead_id, event_type, headline, event_description, detected_at, created_at')
          .eq('user_id', user.id)
          .in('lead_id', leadIds)
          .order('detected_at', { ascending: false })
          .limit(500)
        triggerRows = (triggerRowsRaw ?? []) as TriggerRow[]
      }

      const triggerRowsByLead = new Map<string, TriggerRow[]>()
      for (const row of triggerRows) {
        if (!row.lead_id) continue
        const current = triggerRowsByLead.get(row.lead_id) ?? []
        current.push(row)
        triggerRowsByLead.set(row.lead_id, current)
      }

      const mapped = leadRows.map((row) => {
        const leadTriggers = triggerRowsByLead.get(row.id) ?? []
        const trigger = leadTriggers[0] ?? null
        const companyName = row.company_name ?? row.company_domain ?? row.company_url ?? 'Unknown company'
        const role = parseField(row.ai_personalized_pitch, 'Target role')
        const industry = parseField(row.ai_personalized_pitch, 'Industry')
        return {
          id: row.id,
          companyName,
          companyDomain: row.company_domain ?? null,
          prospectEmail: row.prospect_email ?? null,
          fitScore: parseFitScore(row.ai_personalized_pitch),
          industry,
          role,
          hasHiringSignal: isHiringSignal(trigger),
          whyNow: parseWhyNow(row.ai_personalized_pitch),
          generatedMessage: parseGeneratedMessage(row.ai_personalized_pitch, companyName),
          primaryTrigger: summarizeTrigger(trigger),
          whyThisLead: buildWhyThisLead({
            triggerRows: leadTriggers,
            role,
            industry,
            companyName,
          }),
          createdAt: row.created_at ?? new Date().toISOString(),
        } satisfies OutboundLead
      })

      mapped.sort((a, b) => b.fitScore - a.fitScore || b.createdAt.localeCompare(a.createdAt))
      setLeads(mapped)
      setActiveLeadId((current) => current ?? mapped[0]?.id ?? null)
      track('outbound_execution_loaded', { count: mapped.length })
    } catch {
      setError('Failed to load leads for outbound execution.')
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadOutboundLeads()
  }, [loadOutboundLeads])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const rawStatus = window.localStorage.getItem(STATUS_STORAGE_KEY)
      if (rawStatus) {
        const parsed = JSON.parse(rawStatus) as Record<string, ResponseStatus>
        setResponseStatuses(parsed)
      }
    } catch {
      setResponseStatuses({})
    }
    try {
      const rawDrafts = window.localStorage.getItem(MESSAGE_STORAGE_KEY)
      if (rawDrafts) {
        const parsed = JSON.parse(rawDrafts) as Record<string, string>
        setMessageDrafts(parsed)
      }
    } catch {
      setMessageDrafts({})
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(responseStatuses))
  }, [responseStatuses])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messageDrafts))
  }, [messageDrafts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const rawReplyLearning = window.localStorage.getItem(REPLY_LEARNING_STORAGE_KEY)
      if (rawReplyLearning) {
        const parsed = JSON.parse(rawReplyLearning) as ReplyLearningEntry[]
        setReplyLearningLog(parsed)
      }
    } catch {
      setReplyLearningLog([])
    }
    try {
      const rawProofEntries = window.localStorage.getItem(PROOF_BUILDER_STORAGE_KEY)
      if (rawProofEntries) {
        const parsed = JSON.parse(rawProofEntries) as ProofEntry[]
        setProofEntries(parsed)
      }
    } catch {
      setProofEntries([])
    }
    try {
      const rawRoadmap = window.localStorage.getItem(REVENUE_ROADMAP_STORAGE_KEY)
      if (rawRoadmap) {
        const parsed = JSON.parse(rawRoadmap) as RevenueRoadmapInputs
        setRevenueRoadmap(parsed)
      }
    } catch {
      setRevenueRoadmap({
        messagesSent: 0,
        replies: 0,
        interestedProspects: 0,
        callsBooked: 0,
        trialsStarted: 0,
        paidUsers: 0,
        manualMrr: 0,
      })
    }
    try {
      const rawChecklist = window.localStorage.getItem(DAILY_CHECKLIST_STORAGE_KEY)
      if (rawChecklist) {
        const parsed = JSON.parse(rawChecklist) as Record<string, string[]>
        setDailyChecklistState(parsed)
      }
    } catch {
      setDailyChecklistState({})
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REPLY_LEARNING_STORAGE_KEY, JSON.stringify(replyLearningLog))
  }, [replyLearningLog])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PROOF_BUILDER_STORAGE_KEY, JSON.stringify(proofEntries))
  }, [proofEntries])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REVENUE_ROADMAP_STORAGE_KEY, JSON.stringify(revenueRoadmap))
  }, [revenueRoadmap])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DAILY_CHECKLIST_STORAGE_KEY, JSON.stringify(dailyChecklistState))
  }, [dailyChecklistState])

  const industries = useMemo(() => {
    const values = Array.from(new Set(leads.map((lead) => lead.industry).filter((value) => value !== 'Unknown')))
    values.sort((a, b) => a.localeCompare(b))
    return values
  }, [leads])

  const roles = useMemo(() => {
    const values = Array.from(new Set(leads.map((lead) => lead.role).filter((value) => value !== 'Unknown')))
    values.sort((a, b) => a.localeCompare(b))
    return values
  }, [leads])

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase()
    return leads.filter((lead) => {
      const matchesSearch =
        search.length === 0
        || lead.companyName.toLowerCase().includes(search)
        || (lead.companyDomain ?? '').toLowerCase().includes(search)
      const matchesIndustry = industryFilter === 'all' || lead.industry === industryFilter
      const matchesRole = roleFilter === 'all' || lead.role === roleFilter
      const matchesHiring = hiringFilter === 'all' || lead.hasHiringSignal
      return matchesSearch && matchesIndustry && matchesRole && matchesHiring
    })
  }, [hiringFilter, industryFilter, leads, query, roleFilter])

  const todaysLeadsCount = useMemo(() => {
    const today = todayDateKey()
    return leads.filter((lead) => lead.createdAt.slice(0, 10) === today).length
  }, [leads])

  const activeLead = useMemo(
    () => filteredLeads.find((lead) => lead.id === activeLeadId) ?? filteredLeads[0] ?? null,
    [activeLeadId, filteredLeads]
  )

  const activeDraftKey = useMemo(() => (activeLead ? draftKey(activeLead.id, activeTemplate) : null), [activeLead, activeTemplate])

  const activeMessage = useMemo(() => {
    if (!activeLead) return ''
    if (!activeDraftKey) return ''
    return messageDrafts[activeDraftKey] ?? buildTemplateMessage(activeLead, activeTemplate)
  }, [activeDraftKey, activeLead, activeTemplate, messageDrafts])

  useEffect(() => {
    if (!activeLead || !activeDraftKey) return
    setMessageDrafts((current) => {
      if (current[activeDraftKey]) return current
      return {
        ...current,
        [activeDraftKey]: buildTemplateMessage(activeLead, activeTemplate),
      }
    })
  }, [activeDraftKey, activeLead, activeTemplate])

  const todaysSentCount = useMemo(() => {
    return leads.filter((lead) => SENT_LIKE_STATUSES.has(responseStatuses[lead.id] ?? 'not sent')).length
  }, [leads, responseStatuses])

  const weeklyInsights = useMemo(() => {
    let sent = 0
    let replies = 0
    let interested = 0
    let booked = 0
    let closed = 0
    for (const lead of leads) {
      const status = responseStatuses[lead.id] ?? 'not sent'
      if (SENT_LIKE_STATUSES.has(status)) sent += 1
      if (REPLY_LIKE_STATUSES.has(status)) replies += 1
      if (status === 'interested') interested += 1
      if (status === 'booked') booked += 1
      if (status === 'closed') closed += 1
    }
    const replyRate = sent > 0 ? Math.round((replies / sent) * 1000) / 10 : 0
    return { sent, replies, interested, booked, closed, replyRate }
  }, [leads, responseStatuses])

  const checklistTodayKey = useMemo(() => todayDateKey(), [])
  const checklistForToday = dailyChecklistState[checklistTodayKey] ?? []
  const checklistCompletedCount = checklistForToday.length

  const replyLearningRecommendation = useMemo(
    () => buildReplyRecommendation(replyLearningForm.replyType),
    [replyLearningForm.replyType]
  )
  const replyTemplate = useMemo(() => buildReplyTemplate(replyLearningForm.replyType), [replyLearningForm.replyType])

  const latestProofEntry = proofEntries[0] ?? null
  const proofOutputs = useMemo(() => (latestProofEntry ? buildProofCopy(latestProofEntry) : null), [latestProofEntry])

  const estimatedMrr = revenueRoadmap.manualMrr > 0 ? revenueRoadmap.manualMrr : revenueRoadmap.paidUsers * PLAN_PRICE
  const payingUsersNeededFor1k = Math.ceil(1000 / PLAN_PRICE)
  const payingUsersNeededFor10k = Math.ceil(10000 / PLAN_PRICE)
  const conversionBottleneck = useMemo(() => deriveConversionBottleneck(revenueRoadmap), [revenueRoadmap])

  function saveReplyLearningEntry(): void {
    const replyText = replyLearningForm.replyText.trim()
    if (replyText.length === 0) return
    const entry: ReplyLearningEntry = {
      id: `${Date.now()}`,
      leadId: activeLead?.id ?? null,
      companyName: activeLead?.companyName ?? 'Unknown company',
      replyType: replyLearningForm.replyType,
      replyText,
      createdAt: new Date().toISOString(),
    }
    setReplyLearningLog((current) => [entry, ...current].slice(0, 100))
    setReplyLearningForm((current) => ({ ...current, replyText: '' }))
    track('outbound_reply_learning_logged', { replyType: entry.replyType })
  }

  async function copyReplyTemplate(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${replyTemplate}\n\nGenerated by raelinfo.com`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
      track('outbound_reply_template_copied', { replyType: replyLearningForm.replyType })
    } catch {
      setCopied(false)
    }
  }

  async function copyProofBlock(
    key: 'shortProofSnippet' | 'landingTestimonial' | 'linkedInPostDraft' | 'caseStudyOutline'
  ): Promise<void> {
    const outputs = proofOutputs
    if (!outputs) return
    const text = `${outputs[key]}\n\nGenerated by raelinfo.com`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
      track('outbound_proof_copy_copied', { block: key })
    } catch {
      setCopied(false)
    }
  }

  function saveProofEntry(): void {
    if (proofForm.niche.trim().length === 0 && proofForm.result.trim().length === 0) return
    const entry: ProofEntry = {
      id: `${Date.now()}`,
      customerName: proofForm.customerName.trim(),
      niche: proofForm.niche.trim(),
      problem: proofForm.problem.trim(),
      result: proofForm.result.trim(),
      metric: proofForm.metric,
      quote: proofForm.quote.trim(),
      permissionStatus: proofForm.permissionStatus,
      createdAt: new Date().toISOString(),
    }
    setProofEntries((current) => [entry, ...current].slice(0, 100))
    track('outbound_proof_entry_saved', { permissionStatus: entry.permissionStatus, metric: entry.metric })
  }

  function updateRoadmapField(field: keyof RevenueRoadmapInputs, value: string): void {
    const numericValue = Number.parseInt(value, 10)
    setRevenueRoadmap((current) => ({
      ...current,
      [field]: Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0,
    }))
  }

  function toggleChecklistItem(itemId: string, checked: boolean): void {
    setDailyChecklistState((current) => {
      const todayItems = new Set(current[checklistTodayKey] ?? [])
      if (checked) todayItems.add(itemId)
      else todayItems.delete(itemId)
      return {
        ...current,
        [checklistTodayKey]: Array.from(todayItems),
      }
    })
  }

  function toggleSelected(leadId: string, checked: boolean): void {
    setSelectedLeadIds((current) => {
      const next = new Set(current)
      if (checked) next.add(leadId)
      else next.delete(leadId)
      return next
    })
  }

  function selectTopLeads(): void {
    const topIds = filteredLeads.slice(0, 10).map((lead) => lead.id)
    setSelectedLeadIds(new Set(topIds))
  }

  function exportSelectedLeads(): void {
    const selected = filteredLeads.filter((lead) => selectedLeadIds.has(lead.id))
    if (selected.length === 0) return

    const csv = [
      [
        'company',
        'domain',
        'email',
        'fit_score',
        'industry',
        'role',
        'hiring_signal',
        'response_status',
        'outreach_message',
        'attribution',
      ].join(','),
      ...selected.map((lead) => {
        const message = (messageDrafts[draftKey(lead.id, 'initial')] ?? lead.generatedMessage).replaceAll('"', '""')
        const status = responseStatuses[lead.id] ?? ''
        return [
          `"${lead.companyName.replaceAll('"', '""')}"`,
          `"${(lead.companyDomain ?? '').replaceAll('"', '""')}"`,
          `"${(lead.prospectEmail ?? '').replaceAll('"', '""')}"`,
          `"${lead.fitScore}"`,
          `"${lead.industry.replaceAll('"', '""')}"`,
          `"${lead.role.replaceAll('"', '""')}"`,
          `"${lead.hasHiringSignal ? 'yes' : 'no'}"`,
          `"${status}"`,
          `"${message}"`,
          '"Generated by raelinfo.com"',
        ].join(',')
      }),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `daily-outreach-${todayDateKey()}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    track('outbound_daily_exported', { count: selected.length })
  }

  async function copyTemplateMessage(templateKey: TemplateKey): Promise<void> {
    if (!activeLead) return
    const key = draftKey(activeLead.id, templateKey)
    const templateText = messageDrafts[key] ?? buildTemplateMessage(activeLead, templateKey)
    const text = `${templateText}\n\nGenerated by raelinfo.com`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
      track('outbound_message_copied', { leadId: activeLead.id, template: templateKey })
    } catch {
      setCopied(false)
    }
  }

  function openActiveMessageInEmailClient(): void {
    if (!activeLead) return
    const subjectLabel =
      activeTemplate === 'initial' ? 'Initial outreach' : activeTemplate === 'followup1' ? 'Follow-up #1' : 'Follow-up #2'
    const subject = encodeURIComponent(`${subjectLabel} for ${activeLead.companyName}`)
    const body = encodeURIComponent(`${activeMessage}\n\nGenerated by raelinfo.com`)
    const recipient = activeLead.prospectEmail ?? ''
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`
    track('outbound_message_sent_intent', { leadId: activeLead.id, template: activeTemplate })
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Outbound execution loop</CardTitle>
          <Badge variant="outline">Today&apos;s Leads: {todaysLeadsCount} - Updated today</Badge>
        </div>
        <div className="text-xs text-muted-foreground">Generate - Select - Send - Track - Iterate</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>
        ) : null}

        <div className="rounded border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-foreground">Today&apos;s goal: send {DAILY_SEND_GOAL} messages</div>
            <Badge variant="outline">
              {todaysSentCount}/{DAILY_SEND_GOAL}
            </Badge>
          </div>
          <div className="mt-2 h-2 rounded bg-cyan-500/10 overflow-hidden">
            <div
              className="h-full bg-cyan-400/70 transition-all"
              style={{ width: `${Math.min(100, Math.round((todaysSentCount / DAILY_SEND_GOAL) * 100))}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Progress is based on leads marked sent (local status tracking).</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company/domain" className="lg:col-span-2" />
          <select
            value={hiringFilter}
            onChange={(event) => setHiringFilter(event.target.value === 'hiring' ? 'hiring' : 'all')}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All signals</option>
            <option value="hiring">Hiring signals</option>
          </select>
          <select
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All industries</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={selectTopLeads} disabled={loading || filteredLeads.length === 0}>
            Select top 10
          </Button>
          <Button type="button" size="sm" className="neon-border hover:glow-effect" onClick={exportSelectedLeads} disabled={selectedLeadIds.size === 0}>
            Export selected leads
          </Button>
          <Badge variant="outline">{selectedLeadIds.size} selected</Badge>
          <Badge variant="outline">These leads update daily</Badge>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2 max-h-[420px] overflow-y-auto">
            {filteredLeads.length === 0 ? (
              <div className="text-xs text-muted-foreground">No leads match current ICP filters.</div>
            ) : (
              filteredLeads.slice(0, 40).map((lead) => {
                const status = responseStatuses[lead.id] ?? 'not sent'
                return (
                  <div
                    key={lead.id}
                    className={`rounded border p-2 ${activeLead?.id === lead.id ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-500/10 bg-background/50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedLeadIds.has(lead.id)}
                          onChange={(event) => toggleSelected(lead.id, event.target.checked)}
                          className="mt-1"
                        />
                        <button type="button" className="min-w-0 text-left" onClick={() => setActiveLeadId(lead.id)}>
                          <div className="text-sm font-medium text-foreground truncate">{lead.companyName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {lead.companyDomain ?? 'no domain'} - Fit {lead.fitScore}/100
                          </div>
                        </button>
                      </label>
                      <Badge variant="outline">{status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{lead.industry}</Badge>
                      <Badge variant="outline">{lead.role}</Badge>
                      {lead.hasHiringSignal ? <Badge className="bg-emerald-500/10 text-emerald-200 border-emerald-500/20">Hiring</Badge> : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-3">
            {activeLead ? (
              <>
                <div>
                  <div className="text-sm font-medium text-foreground">{activeLead.companyName}</div>
                  <div className="text-xs text-muted-foreground mt-1">{activeLead.whyNow}</div>
                </div>
                <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Why this lead</div>
                  <div className="text-xs text-foreground">Trigger: {activeLead.primaryTrigger}</div>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {activeLead.whyThisLead.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Message templates</div>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_OPTIONS.map((template) => (
                      <Button
                        key={template.key}
                        type="button"
                        size="sm"
                        variant={activeTemplate === template.key ? 'default' : 'outline'}
                        onClick={() => setActiveTemplate(template.key)}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Outreach view</div>
                  <Textarea
                    value={activeMessage}
                    onChange={(event) =>
                      setMessageDrafts((current) => ({
                        ...current,
                        [draftKey(activeLead.id, activeTemplate)]: event.target.value,
                      }))
                    }
                    className="min-h-[180px]"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void copyTemplateMessage('initial')}>
                    {copied ? 'Copied' : 'Copy initial message'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void copyTemplateMessage('followup1')}>
                    Copy follow-up #1
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void copyTemplateMessage('followup2')}>
                    Copy follow-up #2
                  </Button>
                  <Button type="button" className="neon-border hover:glow-effect" onClick={openActiveMessageInEmailClient}>
                    Open email draft
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Response tracking</div>
                  <div className="flex flex-wrap gap-2">
                    {RESPONSE_STATUS_OPTIONS.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={(responseStatuses[activeLead.id] ?? 'not sent') === status ? 'default' : 'outline'}
                        onClick={() => {
                          setResponseStatuses((current) => ({ ...current, [activeLead.id]: status }))
                          track('outbound_response_status_changed', { leadId: activeLead.id, status })
                        }}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Select a lead to open outreach view.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Weekly learning loop</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Messages sent</div>
                <div className="text-foreground font-medium">{weeklyInsights.sent}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Replies</div>
                <div className="text-foreground font-medium">{weeklyInsights.replies}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Interested</div>
                <div className="text-foreground font-medium">{weeklyInsights.interested}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Booked</div>
                <div className="text-foreground font-medium">{weeklyInsights.booked}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Closed</div>
                <div className="text-foreground font-medium">{weeklyInsights.closed}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-muted-foreground">Reply rate</div>
                <div className="text-foreground font-medium">{weeklyInsights.replyRate}%</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">7-Day First Customer Plan</div>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Day 1:</span> Pick one ICP and send 20 messages.
              </li>
              <li>
                <span className="font-medium text-foreground">Day 2:</span> Send 20 more messages and follow up with Day 1 prospects.
              </li>
              <li>
                <span className="font-medium text-foreground">Day 3:</span> Review replies, refine message, send 25 messages.
              </li>
              <li>
                <span className="font-medium text-foreground">Day 4:</span> Double down on best niche, send 25 messages, book calls.
              </li>
              <li>
                <span className="font-medium text-foreground">Day 5:</span> Offer live demo: &quot;I can generate 5 leads for you right now.&quot;
              </li>
              <li>
                <span className="font-medium text-foreground">Day 6:</span> Follow up all interested prospects and push checkout/demo.
              </li>
              <li>
                <span className="font-medium text-foreground">Day 7:</span> Review messages sent, replies, calls booked, paid users; then pick the winning niche for next week.
              </li>
            </ol>
          </div>
        </div>

        <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
          <div className="text-sm font-medium text-foreground">Outbound copy bank</div>
          {activeLead ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Initial</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {`Hey - noticed ${activeLead.companyName} is ${activeLead.primaryTrigger}.\n\nTeams at this stage usually need more qualified pipeline without more manual research.\n\nI built LeadIntel to find high-intent leads and write outreach daily.\n\nWant me to generate 5 leads for you?`}
                </pre>
                <Button size="sm" variant="outline" onClick={() => void copyTemplateMessage('initial')}>
                  Copy initial
                </Button>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up #1</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {`Quick follow-up - I can show you a short lead list for ${activeLead.companyName} so you can judge if it's useful.`}
                </pre>
                <Button size="sm" variant="outline" onClick={() => void copyTemplateMessage('followup1')}>
                  Copy follow-up #1
                </Button>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up #2</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {'Should I close this out, or would seeing 5 fresh leads for your market be useful?'}
                </pre>
                <Button size="sm" variant="outline" onClick={() => void copyTemplateMessage('followup2')}>
                  Copy follow-up #2
                </Button>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Booked/demo CTA</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {'I can walk you through your lead list live and show how the outreach is generated.'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Select a lead to load company-specific copy blocks.</div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Reply Learning</div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Prospect reply text</label>
              <Textarea
                value={replyLearningForm.replyText}
                onChange={(event) =>
                  setReplyLearningForm((current) => ({
                    ...current,
                    replyText: event.target.value,
                  }))
                }
                className="min-h-[120px]"
                placeholder="Paste the exact reply from the prospect"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Reply type</label>
              <select
                value={replyLearningForm.replyType}
                onChange={(event) =>
                  setReplyLearningForm((current) => ({
                    ...current,
                    replyType: event.target.value as ReplyType,
                  }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {REPLY_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={saveReplyLearningEntry}
              className="neon-border hover:glow-effect"
              disabled={replyLearningForm.replyText.trim().length === 0}
            >
              Save reply learning
            </Button>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Recommended next response</div>
              <div className="text-xs text-foreground">{replyLearningRecommendation.recommendedNextResponse}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Objection handling angle</div>
              <div className="text-xs text-muted-foreground">{replyLearningRecommendation.objectionHandlingAngle}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Suggested follow-up</div>
              <div className="text-xs text-muted-foreground">{replyLearningRecommendation.suggestedFollowUp}</div>
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Reusable response template</div>
              <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{replyTemplate}</pre>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyReplyTemplate()}>
                Copy response template
              </Button>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Recent reply learnings</div>
              {replyLearningLog.length === 0 ? (
                <div className="text-xs text-muted-foreground">No reply learnings logged yet.</div>
              ) : (
                replyLearningLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded border border-cyan-500/10 bg-background/40 p-2 text-xs">
                    <div className="text-foreground font-medium">
                      {entry.companyName} - {entry.replyType}
                    </div>
                    <div className="text-muted-foreground mt-1 line-clamp-2">{entry.replyText}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Proof Builder</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                value={proofForm.customerName}
                onChange={(event) => setProofForm((current) => ({ ...current, customerName: event.target.value }))}
                placeholder="Customer/prospect name"
              />
              <Input
                value={proofForm.niche}
                onChange={(event) => setProofForm((current) => ({ ...current, niche: event.target.value }))}
                placeholder="Niche"
              />
            </div>
            <Textarea
              value={proofForm.problem}
              onChange={(event) => setProofForm((current) => ({ ...current, problem: event.target.value }))}
              placeholder="Problem before LeadIntel"
              className="min-h-[72px]"
            />
            <Textarea
              value={proofForm.result}
              onChange={(event) => setProofForm((current) => ({ ...current, result: event.target.value }))}
              placeholder="Result achieved (example: Generated 37 targeted leads and booked 3 calls in 48 hours using LeadIntel.)"
              className="min-h-[72px]"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={proofForm.metric}
                onChange={(event) => setProofForm((current) => ({ ...current, metric: event.target.value as ProofMetric }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PROOF_METRIC_OPTIONS.map((metric) => (
                  <option key={metric} value={metric}>
                    {metric}
                  </option>
                ))}
              </select>
              <select
                value={proofForm.permissionStatus}
                onChange={(event) =>
                  setProofForm((current) => ({ ...current, permissionStatus: event.target.value as PermissionStatus }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {PERMISSION_OPTIONS.map((permission) => (
                  <option key={permission} value={permission}>
                    {permission}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              value={proofForm.quote}
              onChange={(event) => setProofForm((current) => ({ ...current, quote: event.target.value }))}
              placeholder="Quote/testimonial"
              className="min-h-[72px]"
            />
            <Button
              type="button"
              size="sm"
              className="neon-border hover:glow-effect"
              onClick={saveProofEntry}
              disabled={proofForm.result.trim().length === 0}
            >
              Save proof entry
            </Button>

            {proofOutputs ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Short proof snippet</div>
                <div className="text-xs text-foreground">{proofOutputs.shortProofSnippet}</div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyProofBlock('shortProofSnippet')}>
                  Copy snippet
                </Button>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Landing page testimonial</div>
                <div className="text-xs text-foreground">{proofOutputs.landingTestimonial}</div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyProofBlock('landingTestimonial')}>
                  Copy testimonial
                </Button>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">LinkedIn post draft</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{proofOutputs.linkedInPostDraft}</pre>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyProofBlock('linkedInPostDraft')}>
                  Copy LinkedIn draft
                </Button>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Case study outline</div>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{proofOutputs.caseStudyOutline}</pre>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyProofBlock('caseStudyOutline')}>
                  Copy case study outline
                </Button>
              </div>
            ) : (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                Save one proof entry to generate testimonial and case-study copy.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">$1K -&gt; $10K Revenue Roadmap</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input
                type="number"
                value={revenueRoadmap.messagesSent}
                onChange={(event) => updateRoadmapField('messagesSent', event.target.value)}
                placeholder="Messages sent"
              />
              <Input
                type="number"
                value={revenueRoadmap.replies}
                onChange={(event) => updateRoadmapField('replies', event.target.value)}
                placeholder="Replies"
              />
              <Input
                type="number"
                value={revenueRoadmap.interestedProspects}
                onChange={(event) => updateRoadmapField('interestedProspects', event.target.value)}
                placeholder="Interested"
              />
              <Input
                type="number"
                value={revenueRoadmap.callsBooked}
                onChange={(event) => updateRoadmapField('callsBooked', event.target.value)}
                placeholder="Calls booked"
              />
              <Input
                type="number"
                value={revenueRoadmap.trialsStarted}
                onChange={(event) => updateRoadmapField('trialsStarted', event.target.value)}
                placeholder="Trials"
              />
              <Input
                type="number"
                value={revenueRoadmap.paidUsers}
                onChange={(event) => updateRoadmapField('paidUsers', event.target.value)}
                placeholder="Paid users"
              />
              <Input
                type="number"
                value={revenueRoadmap.manualMrr}
                onChange={(event) => updateRoadmapField('manualMrr', event.target.value)}
                placeholder="Manual MRR (optional)"
              />
            </div>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs space-y-1">
              <div className="text-foreground font-medium">Current estimated MRR: ${estimatedMrr}</div>
              <div className="text-muted-foreground">If you close {payingUsersNeededFor1k} Pro users, you hit ~$1K MRR.</div>
              <div className="text-muted-foreground">If you close {payingUsersNeededFor10k} Pro users, you hit ~$10K MRR.</div>
              <div className="text-muted-foreground">{conversionBottleneck}</div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={estimatedMrr >= 1000 ? 'default' : 'outline'}>$1K MRR</Badge>
              <Badge variant={estimatedMrr >= 3000 ? 'default' : 'outline'}>$3K MRR</Badge>
              <Badge variant={estimatedMrr >= 5000 ? 'default' : 'outline'}>$5K MRR</Badge>
              <Badge variant={estimatedMrr >= 10000 ? 'default' : 'outline'}>$10K MRR</Badge>
            </div>
          </div>

          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Daily Operator Checklist</div>
            <div className="text-xs text-muted-foreground">
              {checklistCompletedCount}/{DAILY_CHECKLIST_ITEMS.length} complete today
            </div>
            <div className="space-y-2">
              {DAILY_CHECKLIST_ITEMS.map((item) => {
                const checked = checklistForToday.includes(item.id)
                return (
                  <label key={item.id} className="flex items-start gap-2 rounded border border-cyan-500/10 bg-background/40 p-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleChecklistItem(item.id, event.target.checked)}
                      className="mt-0.5"
                    />
                    <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Conversion acceleration scripts</div>
            <div className="text-xs text-muted-foreground">
              Use these manual re-engagement scripts for users who viewed value but have not upgraded.
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Email follow-up</div>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {`Subject: Want 5 leads like this in your inbox daily?\n\nYou already saw qualified matches in the demo.\nI can run another 5-lead sample for your niche and show exactly how outreach is generated.\n\nIf useful, I can also unlock a 20% first-month offer this week.`}
                </pre>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">In-app reminder</div>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {`You&apos;ve seen the value. Unlock full access now to get 20+ daily leads and complete outreach sequences.`}
                </pre>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">SMS reminder</div>
                <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {`Quick one: want me to generate 5 fresh leads for your niche today? If helpful, we can unlock full access after you review.`}
                </pre>
              </div>
            </div>
          </div>

          <div className="rounded border border-cyan-500/20 bg-card/30 p-3 space-y-3">
            <div className="text-sm font-medium text-foreground">Social proof panel</div>
            <div className="text-xs text-muted-foreground">
              Pull the strongest recent proof entry into outbound touches to improve demo-to-paid confidence.
            </div>
            {latestProofEntry ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2 text-xs">
                <div className="text-foreground font-medium">Top proof for this week</div>
                <div className="text-muted-foreground">
                  {latestProofEntry.result || 'Generated targeted leads and booked calls quickly using LeadIntel.'}
                </div>
                <div className="text-muted-foreground">
                  Quote: {latestProofEntry.quote || 'LeadIntel helped us move from manual research to daily execution.'}
                </div>
              </div>
            ) : (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                Add at least one proof entry above to populate this social proof panel.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
