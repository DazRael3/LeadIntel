import { isE2E } from '@/lib/runtimeFlags'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const globalExportsKey = '__leadintelE2EExports'
function getE2EExportStore(): Map<string, string> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[globalExportsKey]
  if (existing instanceof Map) return existing as Map<string, string>
  const next = new Map<string, string>()
  g[globalExportsKey] = next
  return next
}

export async function uploadExportCsv(args: {
  workspaceId: string
  jobId: string
  csv: string
}): Promise<{ filePath: string }> {
  const filePath = `exports/${args.workspaceId}/${args.jobId}.csv`

  if (isE2E()) {
    const store = getE2EExportStore()
    store.set(filePath, args.csv)
    return { filePath }
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const bucket = admin.storage.from('exports')
  const bytes = new TextEncoder().encode(args.csv)
  const { error } = await bucket.upload(filePath, bytes, { contentType: 'text/csv', upsert: true })
  if (error) {
    throw new Error('Export upload failed')
  }
  return { filePath }
}

export async function getExportDownload(args: {
  filePath: string
}): Promise<
  | { mode: 'signedUrl'; url: string }
  | { mode: 'inline'; content: string }
> {
  if (isE2E()) {
    const store = getE2EExportStore()
    const content = store.get(args.filePath) ?? ''
    return { mode: 'inline', content }
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const bucket = admin.storage.from('exports')
  const { data, error } = await bucket.createSignedUrl(args.filePath, 60)
  if (error || !data?.signedUrl) {
    throw new Error('Export download unavailable')
  }
  return { mode: 'signedUrl', url: data.signedUrl }
}

