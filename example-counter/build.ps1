$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$ModuleID = "example-counter"
$OutDir = "dist"

Write-Host "==> Building $ModuleID..."

# Clean
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Path $OutDir | Out-Null

# 1. Frontend: concatenate Web Components into widget.js
Write-Host "  -> Building frontend..."
Get-Content frontend/src/counter-widget.js, frontend/src/chart-widget.js |
    Set-Content "$OutDir/widget.js"

# 2. Backend: compile Go binary (static, Linux amd64)
Write-Host "  -> Building backend..."
Push-Location backend
$env:CGO_ENABLED = "0"
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -trimpath -ldflags="-s -w" -o "../$OutDir/backend" .
Pop-Location
# Reset env
$env:CGO_ENABLED = $null
$env:GOOS = $null
$env:GOARCH = $null

# 3. Copy assets
Write-Host "  -> Copying assets..."
Copy-Item manifest.json "$OutDir/"
Copy-Item migrations.sql "$OutDir/"
New-Item -ItemType Directory -Path "$OutDir/locales" -Force | Out-Null
Copy-Item locales/*.json "$OutDir/locales/"
if (Test-Path preview.png) { Copy-Item preview.png "$OutDir/" }

# 4. Package ZIP
Write-Host "  -> Packaging ZIP..."
Compress-Archive -Path "$OutDir/*" -DestinationPath "$ModuleID.zip" -Force

$size = (Get-Item "$ModuleID.zip").Length / 1KB
Write-Host "==> Done: $ModuleID.zip ($([math]::Round($size, 1)) KB)"
