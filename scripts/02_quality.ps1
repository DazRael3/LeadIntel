# scripts\02_quality.ps1
$ErrorActionPreference = "Stop"

Write-Host "== Quality Gates =="

# Helper function to invoke npm safely (avoids npm.ps1 blocked by AV/EDR)
function Invoke-NpmSafe([string[]]$Args) {
  # Prefer npm.cmd to avoid npm.ps1 (commonly blocked by AV/EDR)
  $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
  if ($npmCmd) {
    & $npmCmd.Source @Args
    return
  }

  # If PATH resolves npm to an exe/cmd (NOT .ps1), use it
  $npm = Get-Command "npm" -ErrorAction SilentlyContinue
  if ($npm -and $npm.CommandType -ne 'Alias') {
    $npmSource = $npm.Source
    $npmExt = [System.IO.Path]::GetExtension($npmSource)
    # Only use if it's .exe or .cmd, never .ps1
    if ($npmExt -eq '.exe' -or $npmExt -eq '.cmd') {
      & $npmSource @Args
      return
    }
  }

  # Final fallback: call npm-cli.js directly via node
  # This completely bypasses any PowerShell shims
  $node = Get-Command "node" -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "Node.js not found on PATH."
  }

  $candidatePaths = @(
    Join-Path ${env:ProgramFiles} "nodejs\node_modules\npm\bin\npm-cli.js"
    Join-Path ${env:ProgramFiles(x86)} "nodejs\node_modules\npm\bin\npm-cli.js"
    Join-Path ${env:APPDATA} "npm\node_modules\npm\bin\npm-cli.js"
    Join-Path ${env:LOCALAPPDATA} "npm\node_modules\npm\bin\npm-cli.js"
  ) | Where-Object {
    if ($_) {
      Test-Path -LiteralPath $_
    } else {
      $false
    }
  } | Select-Object -First 1

  if (-not $candidatePaths) {
    throw "Could not locate npm-cli.js. Ensure npm is installed with Node.js and available on PATH."
  }

  & $node.Source $candidatePaths @Args
}

function Run-NpmLike($cmd) {
  if (Test-Path ".\pnpm-lock.yaml") { pnpm $cmd }
  elseif (Test-Path ".\yarn.lock") { yarn $cmd }
  else { Invoke-NpmSafe @("run", $cmd) }
}

Run-NpmLike "lint"
Run-NpmLike "typecheck"

Write-Host "OK"
