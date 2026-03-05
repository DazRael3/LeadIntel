'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'
import type { Lead } from '@/lib/supabaseClient'

type LeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string
  ai_personalized_pitch: string | null
  created_at: string | null
}

type TriggerRow = {
  lead_id: string | null
  headline?: string | null
  event_description?: string | null
  event_type?: string | null
  detected_at?: string | null
  created_at?: string | null
}

type LatestSignal = { type: string; detectedAt: string; title: string }

type LeadWithLatestSignal = Lead & { latestSignal?: LatestSignal }

function isIsoString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const ts = Date.parse(value)
  return Number.isFinite(ts)
}

function toLeadModel(row: LeadRow, latestSignal: LatestSignal | null): LeadWithLatestSignal {
  return {
    id: row.id,
    company_name: row.company_name || row.company_domain || row.company_url,
    trigger_event: latestSignal?.title ?? '',
    ai_personalized_pitch: row.ai_personalized_pitch || '',
    company_domain: row.company_domain || undefined,
    company_url: row.company_url || undefined,
    created_at: row.created_at || new Date().toISOString(),
    ...(latestSignal ? { latestSignal } : {}),
  }
}

export function useLeadLibrary() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadWithLatestSignal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        setLeads([])
        setError(null)
        return
      }

      const { data: leadRows, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name, company_domain, company_url, ai_personalized_pitch, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (leadError) {
        setLeads([])
        setError(formatErrorMessage(leadError))
        return
      }

      // Best-effort: fetch latest trigger per lead to populate "Event".
      const triggersByLead = new Map<string, LatestSignal>()
      try {
        const { data: triggerRows } = await supabase
          .from('trigger_events')
          .select('lead_id, headline, event_description, event_type, detected_at, created_at')
          .eq('user_id', user.id)
          .order('detected_at', { ascending: false })
          .limit(200)

        const rows = (triggerRows || []) as TriggerRow[]
        for (const r of rows) {
          if (!r.lead_id) continue
          if (triggersByLead.has(r.lead_id)) continue
          const title = (r.headline || r.event_description || r.event_type || '').trim()
          const detectedAt = r.detected_at ?? r.created_at
          const type = (r.event_type || '').trim()
          if (!title || !type || !isIsoString(detectedAt)) continue
          triggersByLead.set(r.lead_id, { type, detectedAt, title })
        }
      } catch {
        // ignore
      }

      const rows = (leadRows || []) as LeadRow[]
      setLeads(rows.map((r) => toLeadModel(r, triggersByLead.get(r.id) ?? null)))
      setError(null)
    } catch (err) {
      setLeads([])
      setError(formatErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  return { leads, isLoading, error, refresh }
}

