# scripts\06_smoke_limits.ps1
$ErrorActionPreference = "Stop"
if (-not $env:BASE_URL) { $env:BASE_URL = "http://localhost:3000" }

Write-Host "BASE_URL=$($env:BASE_URL)"

function Invoke-Req($method, $path, $bodyJson) {
  $url = "$($env:BASE_URL)$path"
  try {
    if ($null -ne $bodyJson) {
      $resp = Invoke-WebRequest -Method $method -Uri $url -ContentType "application/json" -Body $bodyJson -UseBasicParsing
    } else {
      $resp = Invoke-WebRequest -Method $method -Uri $url -UseBasicParsing
    }
    Write-Host "$method $path => $($resp.StatusCode)"
    return $resp
  } catch {
    if ($_.Exception.Response) {
      $r = $_.Exception.Response
      Write-Host "$method $path => $([int]$r.StatusCode) $($r.StatusDescription)"
    } else {
      Write-Host "$method $path => ERROR $($_.Exception.Message)"
    }
  }
}

# Oversized payload test (aiming for 413 once maxBytes is enforced)
$big = "a" * 70000
$body = (@{ prompt = $big } | ConvertTo-Json -Depth 10)
Invoke-Req "POST" "/api/generate-pitch" $body

# Rate limit test (GET)
for ($i=1; $i -le 50; $i++) {
  Invoke-Req "GET" "/api/plan" $null
}
