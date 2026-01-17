/**
 * Dry Run Script - Test pitch generation without database dependencies
 */

import * as fs from 'fs'
import * as path from 'path'
import { generatePitch } from '@/lib/ai-logic'

// Load environment variables from .env.local manually (Windows compatible)
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8')
  const lines = envFile.split(/\r?\n/)
  let loaded = 0
  
  lines.forEach(line => {
    // Skip comments and empty lines
    line = line.trim()
    if (!line || line.startsWith('#')) return
    
    // Match KEY=VALUE format
    const match = line.match(/^([^=:#\s]+)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      if (!process.env[key]) {
        process.env[key] = value
        loaded++
      }
    }
  })
  
  console.log(`✅ Loaded ${loaded} environment variables from .env.local`)
} else {
  console.warn(`⚠️  .env.local not found at: ${envPath}`)
  console.warn('   Using system environment variables only')
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY not found in environment variables')
  console.error('Please add OPENAI_API_KEY to your .env.local file')
  process.exit(1)
}

/**
 * Dry run function
 */
async function dryRun() {
  console.log("🚀 Starting Dry Run...")
  console.log("")
  
  // 1. Simulating a Lead Found
  const mockLead = {
    company: "TechNova Solutions",
    event: "Series B Funding of $25M",
    ceo: "Sarah Chen"
  }
  
  console.log(`🔍 Found Lead: ${mockLead.company} - ${mockLead.event}`)
  console.log(`👤 CEO: ${mockLead.ceo}`)
  console.log("")

  // 2. Generating the Pitch
  console.log("🤖 AI is drafting the million-dollar pitch...")
  console.log("")
  
  try {
    // generatePitch signature: (companyName, triggerEvent, ceoName, companyInfo?, userSettings?)
    const pitch = await generatePitch(mockLead.company, mockLead.event, mockLead.ceo, null)
    
    console.log("------------------------------------------")
    console.log("✅ PITCH GENERATED:")
    console.log("------------------------------------------")
    console.log(pitch)
    console.log("------------------------------------------")
    console.log("")
    console.log("💰 If this was live, this lead would now be locked behind your $99/mo paywall.")
    console.log("")
    console.log("✨ Dry run completed successfully!")
  } catch (error: any) {
    console.error("❌ Error during dry run:", error.message)
    process.exit(1)
  }
}

// Run the dry run
dryRun()
