import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssistantAnswer, AssistantReference, AssistantScopeType, AssistantSuggestedAction } from '@/lib/assistant/types'
import { routeAssistantQuery } from '@/lib/assistant/router'
import { suggestedPromptsForScope } from '@/lib/assistant/suggested-prompts'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { deriveNextBestAction } from '@/lib/services/next-best-action'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { buildCommandCenter } from '@/lib/services/command-center'
import { buildExecutiveSummary } from '@/lib/executive/engine'
import { listApprovalRequests } from '@/lib/services/approvals'

function safeHref(path: string): string {
  return path
}

function sources(...items: AssistantReference[]): AssistantReference[] {
  return items.filter(Boolean)
}

export async function answerAssistantQuery(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  scope: { type: AssistantScopeType; id: string | null }
  message: string
}): Promise<AssistantAnswer> {
  const intent = routeAssistantQuery({ scope: args.scope.type, message: args.message })
  const suggestedNext = suggestedPromptsForScope(args.scope.type)

  if (args.scope.type === 'account') {
    const accountId = args.scope.id
    if (!accountId) {
      return {
        answer: 'I’m missing the current account context. Open an account, then try again.',
        sources: [],
        groundingNote: 'No account scope was provided.',
        suggestedNext,
        suggestedActions: [{ kind: 'open_route', label: 'Open dashboard', href: safeHref('/dashboard') }],
        limitationsNote: null,
      }
    }

    const ex = await getAccountExplainability({
      supabase: args.supabase,
      userId: args.userId,
      accountId,
      window: '30d',
      type: null,
      sort: 'recent',
      limit: 50,
    })

    if (!ex) {
      return {
        answer: 'I can’t find that account in your workspace scope.',
        sources: [],
        groundingNote: 'Account explainability lookup returned no result.',
        suggestedNext,
        suggestedActions: [{ kind: 'open_route', label: 'Open dashboard', href: safeHref('/dashboard') }],
        limitationsNote: null,
      }
    }

    const company = ex.account.domain ? `${ex.account.id.slice(0, 8)}… · ${ex.account.domain}` : `${ex.account.id.slice(0, 8)}…`
    const topSignals = ex.signals.slice(0, 3).map((s) => `- ${s.title}`).join('\n')
    const whyNow = [
      `Score: ${ex.scoreExplainability.score}/100`,
      ex.momentum ? `Momentum: ${ex.momentum.label} (${ex.momentum.delta >= 0 ? '+' : ''}${ex.momentum.delta})` : null,
      `Data quality: ${ex.dataQuality.quality} / ${ex.dataQuality.freshness}`,
      topSignals ? `Top signals:\n${topSignals}` : null,
    ]
      .filter((x): x is string => typeof x === 'string')
      .join('\n')

    if (intent.kind === 'next_best_action') {
      const { policies } = await getWorkspacePolicies({ supabase: args.supabase, workspaceId: args.workspaceId })
      const { data: endpoints } = await args.supabase
        .schema('api')
        .from('webhook_endpoints')
        .select('id, enabled')
        .eq('workspace_id', args.workspaceId)
        .eq('enabled', true)
        .limit(1)

      const action = deriveNextBestAction({
        inputs: {
          window: '30d',
          scoreExplainability: ex.scoreExplainability,
          momentum: ex.momentum,
          firstPartyIntent: ex.firstPartyIntent,
          dataQuality: ex.dataQuality,
          sourceHealth: ex.sourceHealth,
          people: ex.people.personas,
          account: { id: ex.account.id, name: ex.account.name, domain: ex.account.domain },
        },
        policies,
        webhooksEnabled: (endpoints ?? []).length > 0,
      })
      return {
        answer: `**Next best action:** ${action.label}\n\n${action.whyNow}\n\n**Why not something else:** ${action.whyNot}`,
        sources: sources({ kind: 'account', id: accountId, label: company, href: safeHref(`/dashboard?lead=${encodeURIComponent(accountId)}`) }),
        groundingNote: 'Grounded in account explainability + next-best-action service.',
        suggestedNext,
        suggestedActions: [
          { kind: 'open_route', label: 'Open action center', href: safeHref(`/dashboard?lead=${encodeURIComponent(accountId)}`) },
          { kind: 'prepare_crm_handoff', label: 'Prepare CRM handoff (preview)', accountId, window: '30d' },
        ],
        limitationsNote: action.limitationsNote ?? null,
      }
    }

    const suggestedActions: AssistantSuggestedAction[] = [
      { kind: 'open_route', label: 'Open full account view', href: safeHref(`/dashboard?lead=${encodeURIComponent(accountId)}`) },
      { kind: 'prepare_crm_handoff', label: 'Prepare CRM handoff (preview)', accountId, window: '30d' },
      { kind: 'prepare_sequencer_handoff', label: 'Prepare sequencer package (preview)', accountId, window: '30d' },
      { kind: 'add_to_queue', label: 'Add manual follow-up to queue', accountId, reason: 'Manual follow-up needed' },
    ]

    return {
      answer: `Here’s what I can say from your current account data:\n\n${whyNow}`,
      sources: sources({ kind: 'account', id: accountId, label: company, href: safeHref(`/dashboard?lead=${encodeURIComponent(accountId)}`) }),
      groundingNote: 'Grounded in account explainability (signals, score, momentum, quality).',
      suggestedNext,
      suggestedActions,
      limitationsNote:
        ex.dataQuality.quality === 'limited' || ex.dataQuality.limitations.length > 0
          ? `Limitations: ${ex.dataQuality.limitations.join(' ')}`
          : null,
    }
  }

  if (args.scope.type === 'command_center') {
    const summary = await buildCommandCenter({ supabase: args.supabase, workspaceId: args.workspaceId, limit: 140 })
    const actNow = summary.lanes.act_now.length
    const blocked = summary.lanes.blocked.length
    const review = summary.lanes.review_needed.length
    const topAct = summary.lanes.act_now.slice(0, 3).map((i) => `- ${i.title}: ${i.subtitle}`).join('\n') || '- —'
    const topBlocked = summary.lanes.blocked.slice(0, 3).map((i) => `- ${i.title}: ${i.subtitle}`).join('\n') || '- —'

    return {
      answer: `**Command Center summary**\n\n- Act now: ${actNow}\n- Review needed: ${review}\n- Blocked: ${blocked}\n\n**Top act-now:**\n${topAct}\n\n**Top blocked:**\n${topBlocked}`,
      sources: sources({ kind: 'route', id: 'command-center', label: '/dashboard/command-center', href: safeHref('/dashboard/command-center') }),
      groundingNote: 'Grounded in command-center lanes derived from queue + approvals.',
      suggestedNext,
      suggestedActions: [{ kind: 'open_route', label: 'Open Command Center', href: safeHref('/dashboard/command-center') }],
      limitationsNote: summary.limitationsNote,
    }
  }

  if (args.scope.type === 'executive') {
    const summary = await buildExecutiveSummary({ supabase: args.supabase, workspaceId: args.workspaceId })
    const highlights = summary.highlights.slice(0, 3).map((h) => `- ${h.title}: ${h.detail}`).join('\n') || '- —'
    const risks = summary.risks.slice(0, 3).map((r) => `- ${r.title}: ${r.detail}`).join('\n') || '- —'
    return {
      answer: `**Executive summary**\n\n**Highlights:**\n${highlights}\n\n**Risks / blockers:**\n${risks}`,
      sources: sources({ kind: 'route', id: 'executive', label: '/dashboard/executive', href: safeHref('/dashboard/executive') }),
      groundingNote: 'Grounded in executive summary engine (queue, approvals, deliveries, programs).',
      suggestedNext,
      suggestedActions: [
        { kind: 'open_route', label: 'Open executive dashboard', href: safeHref('/dashboard/executive') },
        { kind: 'open_route', label: 'Open reporting settings', href: safeHref('/settings/reporting') },
      ],
      limitationsNote: summary.limitationsNote,
    }
  }

  if (args.scope.type === 'approvals') {
    const rows = await listApprovalRequests({ supabase: args.supabase, workspaceId: args.workspaceId, status: 'pending_review', limit: 25 })
    const top = rows.slice(0, 5).map((r) => `- ${r.target_type} ${r.target_id.slice(0, 8)}… (${r.status})`).join('\n') || '- —'
    return {
      answer: `**Approvals pending review:** ${rows.length}\n\n${top}`,
      sources: sources({ kind: 'route', id: 'approvals', label: '/dashboard/approvals', href: safeHref('/dashboard/approvals') }),
      groundingNote: 'Grounded in approval requests (workspace-scoped).',
      suggestedNext,
      suggestedActions: [{ kind: 'open_route', label: 'Open approvals', href: safeHref('/dashboard/approvals') }],
      limitationsNote: 'This view is metadata-first and does not include template body content.',
    }
  }

  return {
    answer: 'I can help, but I’m missing a grounded scope. Try opening an account, Command Center, or Executive view and ask again.',
    sources: [],
    groundingNote: 'No supported scope matched.',
    suggestedNext,
    suggestedActions: [{ kind: 'open_route', label: 'Open dashboard', href: safeHref('/dashboard') }],
    limitationsNote: null,
  }
}

