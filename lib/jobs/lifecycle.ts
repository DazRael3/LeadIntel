import { runLifecycleCron } from '@/lib/growth/lifecycle'

export async function runLifecycleEmails(args: { dryRun?: boolean }) {
  if (args.dryRun) {
    return { status: 'skipped' as const, summary: { reason: 'dry_run' } }
  }
  const summary = await runLifecycleCron()
  return { status: 'ok' as const, summary }
}

