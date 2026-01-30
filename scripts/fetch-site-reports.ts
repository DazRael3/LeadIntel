/**
 * Owner-only utility: fetch site reports using the Supabase service role key
 * and write them to ./admin-reports/YYYY-MM-DD.md.
 *
 * Usage:
 *   npx ts-node scripts/fetch-site-reports.ts --days 7
 *   npx ts-node scripts/fetch-site-reports.ts --from 2026-01-01 --to 2026-01-07
 *
 * NOTE: Keep ./admin-reports private (gitignored).
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type Args = { days?: number; from?: string; to?: string }

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--days' && next) {
      out.days = Number.parseInt(next, 10)
      i++
    } else if (a === '--from' && next) {
      out.from = next
      i++
    } else if (a === '--to' && next) {
      out.to = next
      i++
    }
  }
  return out
}

function isDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function mdForReport(row: {
  report_date: string
  generated_at: string
  summary: Record<string, unknown>
  notes: string | null
}): string {
  const summary = row.summary ?? {}
  const getNum = (k: string) => (typeof summary[k] === 'number' ? (summary[k] as number) : 0)
  const json = JSON.stringify(summary, null, 2)
  return [
    `# Site report for ${row.report_date}`,
    '',
    `Generated at: ${row.generated_at}`,
    '',
    '## Summary',
    '',
    `- Signups: ${getNum('signups')}`,
    `- Trials started: ${getNum('trials_started')}`,
    `- Active users: ${getNum('active_users')}`,
    `- Pitches generated: ${getNum('pitches_generated')}`,
    `- Trigger events ingested: ${getNum('trigger_events_ingested')}`,
    `- Watchlist actions: ${getNum('watchlist_actions')}`,
    '',
    row.notes ? '## Notes\n\n' + row.notes + '\n' : '',
    '## Raw JSON',
    '',
    '```json',
    json,
    '```',
    '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const outDir = join(process.cwd(), 'admin-reports')
  mkdirSync(outDir, { recursive: true })

  const client = createSupabaseAdminClient()

  let q = client.from('site_reports').select('report_date, generated_at, summary, notes').order('report_date', { ascending: false })

  if (args.from && isDateString(args.from)) q = q.gte('report_date', args.from)
  if (args.to && isDateString(args.to)) q = q.lte('report_date', args.to)

  const days = Number.isFinite(args.days ?? NaN) && (args.days ?? 0) > 0 ? (args.days as number) : 7
  if (!args.from && !args.to) q = q.limit(days)

  const { data, error } = await q
  if (error) {
    console.error('❌ Failed to fetch site reports:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as Array<{
    report_date: string
    generated_at: string
    summary: Record<string, unknown>
    notes: string | null
  }>

  for (const row of rows) {
    const filename = join(outDir, `${row.report_date}.md`)
    writeFileSync(filename, mdForReport(row), 'utf8')
  }

  console.log(`✅ Wrote ${rows.length} report(s) to ${outDir}`)
}

// eslint-disable-next-line no-void -- CLI
void main()

