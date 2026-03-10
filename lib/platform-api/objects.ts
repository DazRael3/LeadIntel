import type { PlatformPagination } from '@/lib/platform-api/types'

export type PlatformObject<TType extends string, TAttrs extends Record<string, unknown>> = {
  id: string
  object: TType
  workspace_id: string
  created_at: string | null
  updated_at: string | null
  attributes: TAttrs
}

export type ListResponse<T> = {
  items: T[]
  pagination: PlatformPagination
}

