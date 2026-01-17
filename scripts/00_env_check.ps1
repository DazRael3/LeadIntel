# scripts\00_env_check.ps1
$ErrorActionPreference = "Stop"

Write-Host "== Env Check =="

function Assert-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host "Missing: $name"
    exit 1
  }
}

Assert-Cmd git
Assert-Cmd node

Write-Host ("Node: " + (node -v))
Write-Host ("Git:  " + (git --version))

if (Test-Path ".\pnpm-lock.yaml") { Write-Host "Package manager: pnpm" }
elseif (Test-Path ".\yarn.lock") { Write-Host "Package manager: yarn" }
elseif (Test-Path ".\package-lock.json") { Write-Host "Package manager: npm" }
else { Write-Host "Package manager: unknown (defaulting to npm commands later)" }

Write-Host "OK"
