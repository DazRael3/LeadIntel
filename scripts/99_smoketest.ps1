[CmdletBinding()]
param(
  [switch] $Install,
  [switch] $SkipLint,
  [switch] $SkipTypecheck,
  [switch] $SkipUnit,
  [switch] $SkipE2E,
  [switch] $Clean,
  [string] $EnvFile = ".env.local",
  [switch] $RetryInstallOnLock = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==== $msg ====" -ForegroundColor Cyan
}

function Get-RepoRoot {
  $dir = (Resolve-Path "$PSScriptRoot\..").Path
  while ($true) {
    if (Test-Path (Join-Path $dir "package.json")) { return $dir }
    $parent = Split-Path $dir -Parent
    if ($parent -eq $dir) { throw "Could not find repo root (package.json) from $PSScriptRoot" }
    $dir = $parent
  }
}

function Load-DotEnv([string]$path) {
  if (!(Test-Path $path)) { return }
  Write-Host "Loading env: $path"
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    if ($line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    # strip quotes
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
  }
}

function Get-NpmCmd {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $fallback = Join-Path $env:ProgramFiles "nodejs\npm.cmd"
  if (Test-Path $fallback) { return $fallback }

  throw "npm.cmd not found. Ensure Node.js is installed and npm.cmd is on PATH."
}

function Invoke-Exe {
  param(
    [Parameter(Mandatory=$true)][string] $Exe,
    [Parameter(Mandatory=$true)][string[]] $ArgumentList
  )
  $pretty = ($ArgumentList | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " "
  Write-Host ">> `"$Exe`" $pretty" -ForegroundColor DarkGray

  & $Exe @ArgumentList
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw "Command failed (exit $code): `"$Exe`" $pretty"
  }
}

function Remove-NodeModules([string]$root) {
  $nm = Join-Path $root "node_modules"
  if (Test-Path $nm) {
    Write-Host "Removing node_modules (this can take a bit on Windows)..."
    Remove-Item -Recurse -Force $nm -ErrorAction SilentlyContinue
  }
}

$repo = Get-RepoRoot
Set-Location $repo

Write-Step "Environment"
$npm = Get-NpmCmd
Write-Host "Repo root: $repo"
Write-Host "npm:      $npm"
Write-Host "Invoker:  npm.cmd"

Load-DotEnv (Join-Path $repo $EnvFile)

# Safe defaults ONLY if missing (prevents Next middleware env validation failures)
if ([string]::IsNullOrWhiteSpace($env:UPSTASH_REDIS_REST_URL)) { $env:UPSTASH_REDIS_REST_URL = "https://example.com" }
if ([string]::IsNullOrWhiteSpace($env:UPSTASH_REDIS_REST_TOKEN)) { $env:UPSTASH_REDIS_REST_TOKEN = "test-token" }

Write-Step "Env validation"
Write-Host "UPSTASH_REDIS_REST_URL/TOKEN look OK."

if ($Clean) {
  Write-Step "Clean"
  Remove-NodeModules $repo
}

if ($Install) {
  Write-Step "Install deps"
  $installArgs = @("ci", "--no-audit", "--no-fund")
  try {
    Invoke-Exe -Exe $npm -ArgumentList $installArgs
  } catch {
    if ($RetryInstallOnLock -and $_.Exception.Message -match "EPERM|EBUSY|file is being used|locked") {
      Write-Host "Install appears blocked by Windows file lock. Retrying once after cleanup..." -ForegroundColor Yellow
      Remove-NodeModules $repo
      Invoke-Exe -Exe $npm -ArgumentList $installArgs
    } else {
      throw
    }
  }
}

if (-not $SkipLint) {
  Write-Step "Lint"
  Invoke-Exe -Exe $npm -ArgumentList @("run", "lint")
}

if (-not $SkipTypecheck) {
  Write-Step "Typecheck"
  Invoke-Exe -Exe $npm -ArgumentList @("run", "typecheck")
}

if (-not $SkipUnit) {
  Write-Step "Unit tests"
  Invoke-Exe -Exe $npm -ArgumentList @("run", "test:unit")
}

if (-not $SkipE2E) {
  Write-Step "E2E tests"
  # Make env.ts bypass Upstash strictness if your refine() checks E2E/PLAYWRIGHT
  $env:E2E = "1"
  $env:PLAYWRIGHT = "1"
  Invoke-Exe -Exe $npm -ArgumentList @("run", "test:e2e")
}

Write-Step "Smoke test complete ✅"
