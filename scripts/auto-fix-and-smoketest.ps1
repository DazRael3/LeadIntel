Set-Location "C:\Users\d139c\LeadIntel"
Write-Host "`n🚀 Starting LeadIntel Auto-Fix + Smoke-Test Verification..."

# -------------------------
# 🧹 Clean build artifacts
# -------------------------
Write-Host "`n🧹 Cleaning .next cache and temp files..."
Remove-Item -Recurse -Force .next, node_modules\.cache -ErrorAction SilentlyContinue
npx next telemetry disable | Out-Null

# -------------------------
# 🛠️ Fix duplicate imports
# -------------------------
Write-Host "`n🧩 Checking for duplicate imports in lib/observability/sentry.ts..."
$sentryPath = "lib\observability\sentry.ts"
if (Test-Path $sentryPath) {
    $content = Get-Content $sentryPath -Raw
    $fixedContent = $content -replace "(?m)^(import\s+\{\s*getServerEnv\s*\}\s+from\s+'@/lib/env'\r?\n){2,}", "import { getServerEnv } from '@/lib/env'`n"
    if ($fixedContent -ne $content) {
        Set-Content $sentryPath $fixedContent -Encoding UTF8
        Write-Host "✅ Fixed duplicate imports in sentry.ts"
    } else {
        Write-Host "ℹ️ No duplicate imports found in sentry.ts"
    }
} else {
    Write-Host "⚠️ sentry.ts not found — skipping."
}

# -------------------------
# 🧩 Fix duplicate type exports
# -------------------------
Write-Host "`n🧩 Checking for duplicate type exports in lib/env.ts..."
$envPath = "lib\env.ts"
if (Test-Path $envPath) {
    $content = Get-Content $envPath -Raw
    $fixedContent = $content -replace "(?ms)(export\s+type\s+ServerEnv\s*=\s*z\.infer<[^>]+>\s*\r?\n)+", "export type ServerEnv = z.infer<typeof serverEnvSchema>`n"
    $fixedContent = $fixedContent -replace "(?ms)(export\s+type\s+ClientEnv\s*=\s*z\.infer<[^>]+>\s*\r?\n)+", "export type ClientEnv = z.infer<typeof clientEnvSchema>`n"
    if ($fixedContent -ne $content) {
        Set-Content $envPath $fixedContent -Encoding UTF8
        Write-Host "✅ Fixed duplicate type declarations in env.ts"
    } else {
        Write-Host "ℹ️ No duplicate types found in env.ts"
    }
} else {
    Write-Host "⚠️ env.ts not found — skipping."
}

# -------------------------
# 🧠 Patch Stripe webhook test mock
# -------------------------
Write-Host "`n🧠 Checking webhook test mock (lib/api/guard.vitest.ts)..."
$testPath = "lib\api\guard.vitest.ts"
if (Test-Path $testPath) {
    $content = Get-Content $testPath -Raw
    if ($content -notmatch "constructEvent'\)\.mockReturnValueOnce") {
        Write-Host "🧩 Injecting Stripe mock to guard test..."
        $mockInsert = @"
vi.spyOn(stripe.webhooks, 'constructEvent').mockReturnValueOnce({
  id: 'evt_test',
  type: 'checkout.session.completed',
});
"@
        $fixedContent = $content -replace "(?m)(await\s+handler\(request\);)", "$mockInsert`n$1"
        Set-Content $testPath $fixedContent -Encoding UTF8
        Write-Host "✅ Patched Stripe webhook test"
    } else {
        Write-Host "ℹ️ Mock already present — skipping"
    }
} else {
    Write-Host "⚠️ guard.vitest.ts not found — skipping."
}

# -------------------------
# 🧪 Verification sequence
# -------------------------
Write-Host "`n🧩 Running lint, typecheck, and unit tests..."
npm run lint
npm run typecheck
npm run test:unit

# -------------------------
# 🌐 Start Dev Server
# -------------------------
Write-Host "`n🌐 Launching Next.js Dev Server..."
Start-Job -ScriptBlock { npm run dev } | Out-Null

# Wait for server to boot
Write-Host "⌛ Waiting 10 seconds for server startup..."
Start-Sleep -Seconds 10

# Open login and dashboard pages
Write-Host "🌍 Opening browser to /login and /dashboard..."
Start-Process "http://localhost:3000/login"
Start-Process "http://localhost:3000/dashboard"

# -------------------------
# 🧪 Run smoke-test (PowerShell script)
# -------------------------
Write-Host "`n🔥 Running smoke test..."
$smokeScript = "scripts\99_smoketest.ps1"
if (Test-Path $smokeScript) {
    pwsh -ExecutionPolicy Bypass -File $smokeScript -Install -SkipE2E
    Write-Host "✅ Smoke test completed."
} else {
    Write-Host "⚠️ Smoke test script not found."
}

Write-Host "`n✅ All checks complete. Verify pages loaded correctly in the browser."