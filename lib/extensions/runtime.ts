import type { CustomActionRunContext } from '@/lib/extensions/types'

const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

function getVar(ctx: CustomActionRunContext, key: string): string | null {
  if (key === 'computedAt') return ctx.computedAt
  if (key === 'workspace.id') return ctx.workspaceId
  if (key === 'account.id') return ctx.account.id
  if (key === 'account.name') return ctx.account.name
  if (key === 'account.domain') return ctx.account.domain
  if (key === 'account.program_state') return ctx.account.program_state
  if (key === 'account.lead_id') return ctx.account.lead_id
  return null
}

function renderString(ctx: CustomActionRunContext, s: string): string {
  return s.replace(TEMPLATE_VAR_RE, (_m, keyRaw: string) => {
    const key = (keyRaw ?? '').trim()
    const v = getVar(ctx, key)
    return v ?? ''
  })
}

function renderValue(ctx: CustomActionRunContext, v: unknown, depth: number): unknown {
  if (depth > 6) return null
  if (v === null) return null
  if (typeof v === 'string') return renderString(ctx, v)
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => renderValue(ctx, x, depth + 1))
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).slice(0, 80)) {
      out[k] = renderValue(ctx, obj[k], depth + 1)
    }
    return out
  }
  return null
}

export function renderPayloadTemplate(args: { template: Record<string, unknown>; ctx: CustomActionRunContext }): Record<string, unknown> {
  const rendered = renderValue(args.ctx, args.template, 0)
  return rendered && typeof rendered === 'object' && !Array.isArray(rendered) ? (rendered as Record<string, unknown>) : {}
}

