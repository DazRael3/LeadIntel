import type { PlatformObject } from '@/lib/platform-api/objects'

export type ProgramAccountRow = {
  id: string
  workspace_id: string
  lead_id: string | null
  account_domain: string | null
  account_name: string | null
  program_state: string
  note: string | null
  created_at: string
  updated_at: string
}

type ProgramState = 'strategic' | 'named' | 'expansion_watch' | 'monitor' | 'standard'

function normalizeState(x: string): ProgramState {
  const v = (x ?? '').toLowerCase()
  if (v === 'strategic' || v === 'named' || v === 'expansion_watch' || v === 'monitor') return v
  return 'standard'
}

export function serializeAccountProgramRow(row: ProgramAccountRow): PlatformObject<
  'account',
  {
    lead_id: string | null
    name: string | null
    domain: string | null
    program_state: ProgramState
    note: string | null
  }
> {
  return {
    id: row.id,
    object: 'account',
    workspace_id: row.workspace_id,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    attributes: {
      lead_id: row.lead_id,
      name: row.account_name ?? null,
      domain: row.account_domain ?? null,
      program_state: normalizeState(row.program_state),
      note: row.note ?? null,
    },
  }
}

