# scripts\04_all.ps1
$ErrorActionPreference = "Stop"

& .\scripts\00_env_check.ps1
& .\scripts\01_install.ps1
& .\scripts\02_quality.ps1
& .\scripts\03_tests.ps1

Write-Host "ALL CHECKS PASSED"
