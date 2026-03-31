import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

function isSqlMigrationFilename(name: string): boolean {
  return /^\d+_.+\.sql$/i.test(name)
}

function versionFromFilename(name: string): string | null {
  const m = /^(\d+)_/.exec(name)
  return m ? m[1] : null
}

function getGitTrackedMigrations(): Set<string> | null {
  try {
    const out = execSync('git ls-files -- supabase/migrations', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
    const files = out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => path.basename(p))
      .filter(isSqlMigrationFilename)
    return new Set(files)
  } catch {
    return null
  }
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

  const tracked = getGitTrackedMigrations()
  if (tracked) {
    const extras = files.filter((f) => !tracked.has(f))
    if (extras.length) {
      console.error('[migrations-check] Untracked migration files present in supabase/migrations:')
      for (const f of extras) console.error(`- ${f}`)
      console.error(
        '[migrations-check] This commonly happens when older renamed migrations remain on disk after a pull. ' +
          'Delete the files above or run `git clean -fd supabase/migrations` (review carefully before cleaning).'
      )
      process.exit(1)
    }
  }

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
    console.error('[migrations-check] Full migration file list (sorted):')
    for (const f of files) console.error(`- ${f}`)
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

