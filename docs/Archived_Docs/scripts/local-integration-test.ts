import { generatePitch, calculateDealScore } from '../lib/ai-logic';
import { getMarketPulse } from '../lib/market-pulse';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local manually (Windows compatible)
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  const lines = envFile.split(/\r?\n/);
  
  lines.forEach(line => {
    // Skip comments and empty lines
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    // Match KEY=VALUE format
    const match = line.match(/^([^=:#\s]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  
  console.log('✅ Loaded environment variables from .env.local');
} else {
  console.warn('⚠️  .env.local not found. Using system environment variables only.');
}

async function runFullTest() {
  console.log("🚀 STARTING FULL INTEGRATION TEST...");
  console.log("");

  // 1. Check Market Pulse (The "Live" Hook)
  console.log("📊 Checking Market Pulse...");
  const pulse = await getMarketPulse();
  console.log(`   Status: ${pulse.status.toUpperCase()}`);
  console.log(`   Insight: ${pulse.insight}`);
  console.log(`   Average Change: ${pulse.averageChange.toFixed(2)}%`);
  console.log("");

  // 2. Simulate Finding a High-Value Lead
  const lead = {
    companyName: "FutureScale AI",
    triggerEvent: "Hired new VP of Sales & Secured $15M Series A Funding",
    industry: "Technology / SaaS",
    fundingAmount: 15000000, // $15M
  };
  
  console.log(`🔍 Processing Lead: ${lead.companyName}`);
  console.log(`   Event: ${lead.triggerEvent}`);
  console.log(`   Industry: ${lead.industry}`);
  console.log(`   Funding: $${(lead.fundingAmount! / 1000000).toFixed(0)}M`);
  console.log("");

  // 3. Calculate Deal Score (Value Multiplier)
  console.log("🎯 Calculating Deal Score...");
  const scoreResult = await calculateDealScore({
    companyName: lead.companyName,
    triggerEvent: lead.triggerEvent,
    industry: lead.industry,
    fundingAmount: lead.fundingAmount,
  });
  console.log(`   Fit Score: ${scoreResult.fitScore}/100`);
  console.log(`   Breakdown:`);
  console.log(`     - Funding Score: ${scoreResult.breakdown.fundingScore}`);
  console.log(`     - Industry Score: ${scoreResult.breakdown.industryScore}`);
  console.log(`     - Growth Score: ${scoreResult.breakdown.growthScore}`);
  console.log(`     - Custom Fit: ${scoreResult.breakdown.customScore}`);
  if (scoreResult.growthSignals.length > 0) {
    console.log(`   Growth Signals: ${scoreResult.growthSignals.join(', ')}`);
  }
  console.log("");

  // 4. Generate the "No-Call" Pitch
  console.log("🤖 Generating AI Pitch...");
  const pitch = await generatePitch(
    lead.companyName,
    lead.triggerEvent,
    null, // CEO name
    null, // company info
    undefined // user settings
  );
  
  console.log("");
  console.log("--- PREVIEW OF AUTOMATED OUTPUT ---");
  console.log(`To: ${lead.companyName}`);
  console.log(`Subject: Intelligence on ${lead.companyName}`);
  console.log("");
  console.log(pitch);
  console.log("-----------------------------------");
  console.log("");

  console.log("✅ INTEGRATION SUCCESSFUL: Data is flowing from Market -> Lead -> AI Pitch.");
  console.log("");
  console.log("Summary:");
  console.log(`  • Market Pulse: ${pulse.status}`);
  console.log(`  • Deal Score: ${scoreResult.fitScore}/100`);
  console.log(`  • Pitch Generated: ${pitch.length} characters`);
}

runFullTest();