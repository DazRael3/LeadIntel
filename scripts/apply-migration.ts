/**
 * Migration Helper Script
 * Lists available migrations and displays SQL for manual execution in Supabase SQL Editor
 * 
 * Usage: 
 *   npm run migration                    # Show default migration (0004_digest_settings.sql)
 *   npm run migration list               # List all available migrations
 *   npm run migration <filename>         # Show specific migration
 * 
 * Examples:
 *   npm run migration 0004_digest_settings.sql
 *   npm run migration supabase/migrations/0005_missing_columns.sql
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

function listMigrations(): string[] {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(file => extname(file) === '.sql')
      .map(file => basename(file))
      .sort()
    return files
  } catch (error: any) {
    console.error('❌ Error reading migrations directory:', error.message)
    return []
  }
}

function showMigration(migrationFile: string) {
  try {
    const fullPath = migrationFile.startsWith('/') || migrationFile.match(/^[A-Z]:/)
      ? migrationFile
      : migrationFile.includes('/')
        ? join(process.cwd(), migrationFile)
        : join(MIGRATIONS_DIR, migrationFile)

    console.log(`\n📄 Reading migration file: ${basename(fullPath)}\n`)
    const sql = readFileSync(fullPath, 'utf-8')
    
    if (!sql.trim()) {
      console.error('❌ Error: Migration file is empty')
      process.exit(1)
    }

    console.log('='.repeat(80))
    console.log('📋 SQL Migration to Execute')
    console.log('='.repeat(80))
    console.log(`\n📁 File: ${basename(fullPath)}`)
    console.log('\n📝 Instructions:')
    console.log('   1. Open your Supabase Dashboard')
    console.log('   2. Go to SQL Editor')
    console.log('   3. Create a new query')
    console.log('   4. Copy and paste the SQL below')
    console.log('   5. Click "Run" to execute')
    console.log('   6. After running, refresh PostgREST schema cache (see below)\n')
    console.log('='.repeat(80))
    console.log('\n' + sql + '\n')
    console.log('='.repeat(80))
    console.log('\n⚠️  IMPORTANT: After running the migration, refresh PostgREST schema cache:')
    console.log('\n   Run this in Supabase SQL Editor:')
    console.log('   ────────────────────────────────────────────────────────────────────')
    console.log('   NOTIFY pgrst, \'reload schema\';')
    console.log('   ────────────────────────────────────────────────────────────────────')
    console.log('\n   Or restart Supabase API in the dashboard (Settings → API → Restart)')
    console.log('\n✅ Then restart your Next.js dev server: npm run dev\n')
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: Migration file not found: ${migrationFile}`)
      console.error(`\n💡 Available migrations:`)
      const migrations = listMigrations()
      if (migrations.length > 0) {
        migrations.forEach(m => console.error(`   - ${m}`))
      } else {
        console.error('   (no migrations found)')
      }
      console.error(`\n💡 Usage: npm run migration <filename>`)
    } else {
      console.error('❌ Error reading migration file:', error.message)
    }
    process.exit(1)
  }
}

function showMigrationsList() {
  const migrations = listMigrations()
  
  console.log('\n📦 Available Migrations')
  console.log('='.repeat(80))
  
  if (migrations.length === 0) {
    console.log('\n❌ No migrations found in supabase/migrations/')
    return
  }

  console.log(`\nFound ${migrations.length} migration file(s):\n`)
  migrations.forEach((m, idx) => {
    console.log(`   ${(idx + 1).toString().padStart(2, ' ')}. ${m}`)
  })
  
  console.log('\n💡 To view a specific migration:')
  console.log('   npm run migration <filename>')
  console.log('\n   Example: npm run migration 0004_digest_settings.sql\n')
}

// Main execution
const command = process.argv[2]

if (command === 'list' || command === 'ls') {
  showMigrationsList()
} else if (command && (command === '--help' || command === '-h' || command === 'help')) {
  console.log('\n📋 Migration Helper')
  console.log('='.repeat(80))
  console.log('\nUsage:')
  console.log('  npm run migration                Show default migration (0004_digest_settings.sql)')
  console.log('  npm run migration list           List all available migrations')
  console.log('  npm run migration <filename>     Show specific migration')
  console.log('\nExamples:')
  console.log('  npm run migration 0004_digest_settings.sql')
  console.log('  npm run migration supabase/migrations/0005_missing_columns.sql\n')
} else {
  // Default: show digest settings migration or specified migration
  const migrationFile = command || '0004_digest_settings.sql'
  showMigration(migrationFile)
}
