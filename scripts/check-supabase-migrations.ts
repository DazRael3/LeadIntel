import fs from 'node:fs'
import path from 'node:path'

function isSqlMigrationFilename(name: string): boolean {
  return /^\d+_.+\.sql$/i.test(name)
}

function versionFromFilename(name: string): string | null {
  const m = /^(\d+)_/.exec(name)
  return m ? m[1] : null
}

function main(): void {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    console.error(`[migrations-check] Missing directory: ${migrationsDir}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(isSqlMigrationFilename)
    .sort((a, b) => a.localeCompare(b))

  const versions = new Map<string, string[]>()
  for (const f of files) {
    const v = versionFromFilename(f)
    if (!v) continue
    const arr = versions.get(v) ?? []
    arr.push(f)
    versions.set(v, arr)
  }

  const dupes = Array.from(versions.entries()).filter(([, arr]) => arr.length > 1)
  if (dupes.length) {
    console.error('[migrations-check] Duplicate migration versions detected:')
    for (const [v, arr] of dupes.sort((a, b) => Number(a[0]) - Number(b[0]))) {
      console.error(`- ${v}: ${arr.join(', ')}`)
    }
    process.exit(1)
  }

  // Verify monotonic by filename sort: versions should never decrease.
  let prev = -1
  for (const f of files) {
    const v = versionFromFilename(f)
    if (!v) continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (n < prev) {
      console.error(`[migrations-check] Migration versions not monotonic (saw ${v} after ${String(prev).padStart(v.length, '0')}).`)
      process.exit(1)
    }
    prev = n
  }

  const latest = files.at(-1) ?? null
  console.log(`[migrations-check] OK (${files.length} migrations). Latest=${latest ?? 'none'}`)
}

main()

