import { verifyEmbedToken } from '@/lib/embed/security'
import { getEmbedShortlist } from '@/lib/embed/engine'
import { EmbedErrorState } from '@/components/embed/EmbedErrorState'
import { EmbedFrame } from '@/components/embed/EmbedFrame'
import { ShortlistWidget } from '@/components/embed/ShortlistWidget'

export const dynamic = 'force-dynamic'

export default async function EmbedShortlistPage(props: { searchParams: Promise<{ token?: string; limit?: string }> }) {
  const sp = await props.searchParams
  const token = (sp.token ?? '').trim()
  const payload = token ? verifyEmbedToken(token) : null
  if (!payload || payload.kind !== 'shortlist') return <EmbedErrorState title="Embed invalid" detail="Token is invalid or expired." />

  const rawLimit = Number.parseInt((sp.limit ?? '').trim(), 10)
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(25, rawLimit)) : 10

  const data = await getEmbedShortlist({ workspaceId: payload.workspaceId, limit })
  return (
    <EmbedFrame title="Shortlist" subtitle="Embed-safe widget">
      <ShortlistWidget data={data} />
    </EmbedFrame>
  )
}

